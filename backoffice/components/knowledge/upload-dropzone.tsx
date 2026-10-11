"use client";

import { useRef, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useUploadKnowledgeFile } from "@/lib/queries";
import { cn } from "@/lib/utils";

type UploadStatus = { id: number; name: string; state: "uploading" | "done" | "error"; message?: string };

let nextId = 0;

export function UploadDropzone({ accept }: { accept: string[] }) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadKnowledgeFile();
  const [dragging, setDragging] = useState(false);
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);

  const update = (id: number, patch: Partial<UploadStatus>) =>
    setStatuses((current) => current.map((status) => (status.id === id ? { ...status, ...patch } : status)));

  async function uploadAll(files: File[]) {
    const queued = files.map((file) => ({ id: nextId++, name: file.name, state: "uploading" as const }));
    setStatuses((current) => [...queued, ...current].slice(0, 12));
    // One at a time, so each upload is checked against the space the previous ones used.
    for (const [index, file] of files.entries()) {
      const id = queued[index]!.id;
      try {
        const result = await upload.mutateAsync({ file });
        update(id, { state: "done", message: result.replaced ? "Reemplazó a la versión anterior" : "Subido" });
      } catch (error) {
        update(id, { state: "error", message: error instanceof Error ? error.message : "No se pudo subir" });
      }
    }
  }

  return (
    <Card className="shadow-xs">
      <CardContent className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const files = Array.from(event.dataTransfer.files);
            if (files.length > 0) void uploadAll(files);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
            dragging && "border-primary bg-primary/5",
          )}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadIcon className="size-5" />
          </div>
          <span className="font-medium">Arrastrá archivos o hacé clic para elegirlos</span>
          <span className="text-sm text-muted-foreground">
            PDF, Word, Excel, PowerPoint, CSV, texto o Markdown. Un archivo con el mismo nombre reemplaza al anterior.
          </span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={accept.join(",")}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) void uploadAll(files);
          }}
        />
        {statuses.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {statuses.map((status) => (
              <li key={status.id} className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                <span className="mt-0.5">
                  {status.state === "uploading" ? (
                    <Spinner className="size-4" />
                  ) : status.state === "done" ? (
                    <CircleCheckIcon className="size-4 text-emerald-600" />
                  ) : (
                    <CircleAlertIcon className="size-4 text-destructive" />
                  )}
                </span>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{status.name}</span>
                  {status.message ? (
                    <span className={cn("text-xs", status.state === "error" ? "text-destructive" : "text-muted-foreground")}>
                      {status.message}
                    </span>
                  ) : null}
                </span>
                {status.state !== "uploading" ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Quitar de la lista"
                    onClick={() => setStatuses((current) => current.filter((item) => item.id !== status.id))}
                  >
                    <XIcon />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
