"use client";

import { useState } from "react";
import { Button as LiquidButton } from "@onlymoein/liquidglass";
import { GlobeIcon, LockIcon, UploadIcon } from "lucide-react";
import { FilePreviewDialog } from "@/components/knowledge/file-preview-dialog";
import { KnowledgeBrowser } from "@/components/knowledge/knowledge-browser";
import { useUploadQueue } from "@/components/knowledge/upload-dropzone";
import { UsageCard } from "@/components/knowledge/usage-card";
import { Panel, Section } from "@/components/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LiquidSegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
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
          <div className="flex flex-wrap items-center gap-2.5">
            <LiquidSegmentedControl
              aria-label="Visibilidad al subir"
              size="sm"
              value={uploadVisibility}
              onValueChange={(value) => {
                if (value === "internal" || value === "public")
                  setUploadVisibility(value);
              }}
              className="w-fit min-w-56"
              items={[
                {
                  value: "internal",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <LockIcon className="size-3.5" />
                      Interno
                    </span>
                  ),
                },
                {
                  value: "public",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      <GlobeIcon className="size-3.5" />
                      Público
                    </span>
                  ),
                },
              ]}
            />
            <LiquidButton
              variant="filled"
              size="regular"
              icon={<UploadIcon className="size-4" />}
              className="!h-9 !px-4 !text-sm !font-semibold"
              onClick={() => queue.pick()}
              disabled={!query.data}
            >
              Subir archivos
            </LiquidButton>
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
