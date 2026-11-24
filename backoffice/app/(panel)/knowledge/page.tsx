"use client";

import { useState } from "react";
import { UploadIcon } from "lucide-react";
import { FilePreviewDialog } from "@/components/knowledge/file-preview-dialog";
import { KnowledgeBrowser } from "@/components/knowledge/knowledge-browser";
import { useUploadQueue } from "@/components/knowledge/upload-dropzone";
import { UsageCard } from "@/components/knowledge/usage-card";
import { Panel, Section } from "@/components/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useKnowledgeFiles } from "@/lib/queries";
import type { KnowledgeFile } from "@/lib/types";

export default function KnowledgePage() {
  const query = useKnowledgeFiles();
  const [preview, setPreview] = useState<KnowledgeFile | null>(null);
  const accept = query.data?.acceptedExtensions ?? [];
  const queue = useUploadQueue(accept);
  const files = query.data?.files ?? [];

  return (
    <div className="@container/content flex flex-col gap-4 px-4 lg:px-6">
      <Section
        title="Archivos del asistente"
        description="Documentos que usa el asistente para responder. Organízalos en carpetas; subir un archivo con el mismo nombre en la misma carpeta reemplaza la versión anterior."
        actions={
          <Button onClick={() => queue.pick()} disabled={!query.data}>
            <UploadIcon />
            Subir archivos
          </Button>
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
            Haz clic en un archivo para ver el texto extraído. Arrastra archivos
            o carpetas para moverlos.
          </p>
        ) : null}
      </Section>
      {queue.input}

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
