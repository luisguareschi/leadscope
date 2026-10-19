"use client";

import { useState } from "react";
import { UploadIcon } from "lucide-react";
import { FilePreviewDialog } from "@/components/knowledge/file-preview-dialog";
import { FilesTable } from "@/components/knowledge/files-table";
import {
  DropTarget,
  EmptyDropzone,
  UploadRows,
  useUploadQueue,
} from "@/components/knowledge/upload-dropzone";
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
        description="Precios desde, tipologías, fechas de entrega y orientación salen de acá. Para actualizar un archivo, subí la versión nueva con el mismo nombre: reemplaza a la anterior."
        actions={
          <Button onClick={queue.pick} disabled={!query.data}>
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
          <Skeleton className="h-[4.5rem] w-full rounded-xl" />
        )}

        <DropTarget queue={queue}>
          <Panel>
            <UploadRows queue={queue} />
            {query.isPending ? (
              <div className="flex flex-col gap-2 p-5">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : files.length > 0 ? (
              <FilesTable
                files={files}
                accept={accept}
                onPreview={setPreview}
              />
            ) : query.data ? (
              <EmptyDropzone queue={queue} />
            ) : null}
          </Panel>
        </DropTarget>
        {files.length > 0 ? (
          <p className="-mt-2 text-xs text-muted-foreground">
            Hacé clic en un archivo para ver el texto que lee el asistente.
            También podés arrastrar archivos sobre la lista.
          </p>
        ) : null}
      </Section>
      {queue.input}

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
