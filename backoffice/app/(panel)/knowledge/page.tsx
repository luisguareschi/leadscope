"use client";

import { useState } from "react";
import { GlobeIcon, LockIcon, UploadIcon } from "lucide-react";
import { FilePreviewDialog } from "@/components/knowledge/file-preview-dialog";
import { KnowledgeBrowser } from "@/components/knowledge/knowledge-browser";
import { useUploadQueue } from "@/components/knowledge/upload-dropzone";
import { UsageCard } from "@/components/knowledge/usage-card";
import { Panel, Section } from "@/components/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKnowledgeFiles } from "@/lib/queries";
import type { KnowledgeFile, KnowledgeVisibility } from "@/lib/types";

export default function KnowledgePage() {
  const query = useKnowledgeFiles();
  const [preview, setPreview] = useState<KnowledgeFile | null>(null);
  const [uploadVisibility, setUploadVisibility] =
    useState<KnowledgeVisibility>("internal");
  const accept = query.data?.acceptedExtensions ?? [];
  const queue = useUploadQueue(accept, uploadVisibility);
  const files = query.data?.files ?? [];

  return (
    <div className="@container/content flex flex-col gap-4 px-4 lg:px-6">
      <Section
        title="Archivos del asistente"
        description="Sube documentos internos (solo conocimiento para responder) o archivos públicos (brochures, PDFs e imágenes que el asistente y los asesores pueden enviar al lead)."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              value={uploadVisibility}
              onValueChange={(value) => {
                if (value === "internal" || value === "public")
                  setUploadVisibility(value);
              }}
            >
              <TabsList aria-label="Visibilidad al subir" className="h-9">
                <TabsTrigger value="internal" className="px-2.5 text-xs">
                  <LockIcon className="size-3.5" />
                  Interno
                </TabsTrigger>
                <TabsTrigger value="public" className="px-2.5 text-xs">
                  <GlobeIcon className="size-3.5" />
                  Público (enviable)
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button onClick={() => queue.pick()} disabled={!query.data}>
              <UploadIcon />
              Subir archivos
            </Button>
          </div>
        }
      >
        {query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>No se pudieron cargar los archivos</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : null}

        {query.data ? (
          <UsageCard usage={query.data.usage} fileCount={files.length} />
        ) : (
          <Skeleton className="h-18 w-full rounded-xl" />
        )}

        {query.data ? (
          <KnowledgeBrowser
            data={query.data}
            accept={accept}
            queue={queue}
            onPreview={setPreview}
          />
        ) : query.isPending ? (
          <Panel>
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Panel>
        ) : null}
        {files.length > 0 || (query.data?.folders.length ?? 0) > 0 ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            Los archivos marcados como <strong>Público</strong> pueden ser
            enviados al lead por el asistente o desde el chat. Las imágenes se
            suben siempre como públicas.
          </p>
        ) : null}
      </Section>
      {queue.input}

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
