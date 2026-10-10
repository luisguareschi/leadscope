"use client";

import { useState } from "react";
import { BookOpenTextIcon, InfoIcon } from "lucide-react";
import { FilePreviewDialog } from "@/components/knowledge/file-preview-dialog";
import { FilesTable } from "@/components/knowledge/files-table";
import { UploadDropzone } from "@/components/knowledge/upload-dropzone";
import { UsageCard } from "@/components/knowledge/usage-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useKnowledgeFiles } from "@/lib/queries";
import type { KnowledgeFile } from "@/lib/types";

export default function KnowledgePage() {
  const query = useKnowledgeFiles();
  const [preview, setPreview] = useState<KnowledgeFile | null>(null);
  const accept = query.data?.acceptedExtensions ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Alert className="border-primary/30 bg-primary/5">
        <InfoIcon />
        <AlertTitle>El asistente responde solo con lo que está en estos archivos</AlertTitle>
        <AlertDescription>
          Precios desde, tipologías, fechas de entrega y orientación salen de acá. Cuando cambie algo, subí la versión nueva con
          el mismo nombre: reemplaza a la anterior y el asistente la usa desde la próxima respuesta.
        </AlertDescription>
      </Alert>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar los archivos</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 @4xl/main:grid-cols-[minmax(0,1fr)_22rem]">
        <UploadDropzone accept={accept} />
        {query.data ? (
          <UsageCard usage={query.data.usage} fileCount={query.data.files.length} />
        ) : (
          <Skeleton className="h-44 w-full rounded-xl" />
        )}
      </div>

      <Card className="gap-0 pb-0 shadow-xs">
        <CardHeader className="border-b pb-4">
          <CardTitle>Archivos</CardTitle>
          <CardDescription>Hacé clic en un archivo para ver el texto que lee el asistente.</CardDescription>
        </CardHeader>
        {query.isPending ? (
          <div className="flex flex-col gap-2 p-4 lg:p-6">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : query.data && query.data.files.length > 0 ? (
          <FilesTable files={query.data.files} accept={accept} onPreview={setPreview} />
        ) : (
          <Empty className="border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenTextIcon />
              </EmptyMedia>
              <EmptyTitle>Todavía no hay archivos</EmptyTitle>
              <EmptyDescription>
                Subí la ficha de proyectos (precios, tipologías, entrega, orientación) y las preguntas frecuentes.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </Card>

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
