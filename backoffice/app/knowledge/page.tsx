"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Shell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type KnowledgeFile = {
  id: string;
  filename: string;
  format: string;
  byteSize: number;
  extractedBytes: number;
  updatedAt: string;
};

type KnowledgeList = {
  files: KnowledgeFile[];
  limits: { maxFileBytes: number; maxCompanyBytes: number; maxUploadBytes: number };
};

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 && bytes % (1024 * 1024) === 0) return `${bytes / (1024 * 1024)} MB`;
  if (bytes >= 1024 && bytes % 1024 === 0) return `${bytes / 1024} KB`;
  return `${bytes} B`;
}

export default function KnowledgePage() {
  return (
    <Shell>
      <Knowledge />
    </Shell>
  );
}

function Knowledge() {
  const { token } = useAuth();
  const client = useQueryClient();
  const uploadRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["knowledge"],
    enabled: Boolean(token),
    queryFn: () => api<KnowledgeList>("/internal/knowledge/files", token!),
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return api<{ file: KnowledgeFile }>("/internal/knowledge/files", token!, { method: "POST", body });
    },
    onSuccess: () => {
      setError("");
      void client.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const replace = useMutation({
    mutationFn: (input: { id: string; file: File }) => {
      const body = new FormData();
      body.append("file", input.file);
      return api<{ file: KnowledgeFile }>(`/internal/knowledge/files/${input.id}`, token!, { method: "PUT", body });
    },
    onSuccess: () => {
      setError("");
      void client.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/internal/knowledge/files/${id}`, token!, { method: "DELETE" }),
    onSuccess: () => {
      setError("");
      void client.invalidateQueries({ queryKey: ["knowledge"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const files = query.data?.files ?? [];
  const limits = query.data?.limits;

  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader>
        <CardTitle>Archivos</CardTitle>
        <CardDescription>
          Subí PDF, DOCX, PPTX, ODT, XLSX, CSV, Markdown o texto plano. El mismo nombre reemplaza la versión
          anterior. Si no la volvés a subir, los precios quedan desactualizados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {limits ? (
          <p className="text-sm text-muted-foreground">
            Hasta {formatBytes(limits.maxFileBytes)} de texto por archivo y {formatBytes(limits.maxCompanyBytes)} por
            empresa. El archivo original no puede pasar de {formatBytes(limits.maxUploadBytes)}.
          </p>
        ) : null}
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx,.odt,.xlsx,.csv,.tsv,.txt,.md,.markdown,.text"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) upload.mutate(file);
          }}
        />
        <Button onClick={() => uploadRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Subiendo…" : "Subir archivo"}
        </Button>
        {query.isError ? <p className="text-sm text-destructive">No se pudo cargar la lista.</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {query.data && files.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay archivos.</p>
        ) : null}
        <ul className="divide-y">
          {files.map((file) => (
            <li key={file.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="block truncate font-medium">{file.filename}</span>
                <span className="block text-sm text-muted-foreground">
                  {file.format.toUpperCase()} · texto {formatBytes(file.extractedBytes)} ·{" "}
                  {new Date(file.updatedAt).toLocaleString()}
                </span>
              </span>
              <span className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <label>
                    Reemplazar
                    <input
                      type="file"
                      className="sr-only"
                      accept=".pdf,.docx,.pptx,.odt,.xlsx,.csv,.tsv,.txt,.md,.markdown,.text"
                      onChange={(event) => {
                        const next = event.target.files?.[0];
                        event.target.value = "";
                        if (next) replace.mutate({ id: file.id, file: next });
                      }}
                    />
                  </label>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remove.mutate(file.id)}
                  disabled={remove.isPending}
                >
                  Eliminar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
