"use client";

import { useEffect, useState } from "react";
import {
  DownloadIcon,
  ExternalLinkIcon,
  EyeIcon,
  FileTextIcon,
  FileTypeIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsIOS } from "@/hooks/use-is-ios-pwa";
import { formatBytes, formatNumber } from "@/lib/format";
import { useFetchBlob, useKnowledgeFileText } from "@/lib/queries";
import type { KnowledgeFile } from "@/lib/types";
import { cn } from "@/lib/utils";

const IMAGE_FORMATS = new Set(["jpg", "png", "webp"]);
const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export type FilePreviewKind = "image" | "pdf" | "text" | "none";

/** Determines the primary inline preview mode for an uploaded Conocimiento file. */
export function filePreviewKind(file: KnowledgeFile): FilePreviewKind {
  const mime = file.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (
    file.hasFile &&
    (IMAGE_FORMATS.has(file.format) || IMAGE_MIMES.has(mime))
  ) {
    return "image";
  }
  if (file.hasFile && (file.format === "pdf" || mime === "application/pdf")) {
    return "pdf";
  }
  if (file.charCount > 0) {
    return "text";
  }
  return "none";
}

type PreviewTab = "visual" | "text";

type BlobState = {
  url: string | null;
  blob: Blob | null;
  error: string | null;
};

export function FilePreviewDialog({
  file,
  onClose,
}: {
  file: KnowledgeFile | null;
  onClose: () => void;
}) {
  const kind: FilePreviewKind = file ? filePreviewKind(file) : "none";
  const isVisualDialog = kind === "image" || kind === "pdf";

  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "flex max-h-[calc(100dvh-2rem-var(--safe-top)-var(--safe-bottom))] flex-col gap-4 overflow-y-auto",
          isVisualDialog ? "sm:max-w-4xl" : "sm:max-w-3xl",
        )}
      >
        {file ? (
          <FilePreviewBody
            key={`${file.id}:${file.updatedAt}`}
            file={file}
            kind={kind}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function safeImageMime(file: KnowledgeFile, rawBlob: Blob): string {
  const candidates = [file.mimeType, rawBlob.type];
  for (const candidate of candidates) {
    const base = candidate.split(";")[0]?.trim().toLowerCase() ?? "";
    if (IMAGE_MIMES.has(base)) return base;
  }
  return "image/png";
}

function FilePreviewBody({
  file,
  kind,
}: {
  file: KnowledgeFile;
  kind: FilePreviewKind;
}) {
  const fetchBlob = useFetchBlob();
  // WebKit shows only the first page of a PDF in an iframe, with no scroll or zoom.
  const isIOS = useIsIOS();
  const [activeTab, setActiveTab] = useState<PreviewTab>("visual");
  const [blobState, setBlobState] = useState<BlobState | null>(null);
  const [downloading, setDownloading] = useState(false);

  const hasTabs = kind === "pdf" && file.charCount > 0;
  const visualActive =
    kind === "image" || (kind === "pdf" && activeTab === "visual");
  const textActive =
    file.charCount > 0 &&
    (kind === "text" || (kind === "pdf" && activeTab === "text"));
  const needsBlob = kind === "image" || kind === "pdf";
  const downloadPath = `/internal/knowledge/files/${file.id}/download?v=${encodeURIComponent(file.updatedAt)}`;

  useEffect(() => {
    if (!needsBlob) return;
    let active = true;
    let objectUrl: string | null = null;

    void fetchBlob(downloadPath)
      .then((rawBlob) => {
        if (!active) return;
        const typedBlob =
          kind === "pdf"
            ? new Blob([rawBlob], { type: "application/pdf" })
            : new Blob([rawBlob], { type: safeImageMime(file, rawBlob) });
        objectUrl = URL.createObjectURL(typedBlob);
        setBlobState({ url: objectUrl, blob: typedBlob, error: null });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setBlobState({
          url: null,
          blob: null,
          error:
            error instanceof Error
              ? error.message
              : "No se pudo cargar la vista previa.",
        });
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [needsBlob, downloadPath, file, kind, fetchBlob]);

  const textQuery = useKnowledgeFileText(textActive ? file.id : null);

  const blobLoading = needsBlob && blobState === null;
  const blobUrl = blobState?.url ?? null;
  const blobError = blobState?.error ?? null;
  const isLegacyPdf = file.format === "pdf" && !file.hasFile;

  const openInNewTab = () => {
    if (!blobState?.blob) return;
    // Dedicated URL so closing the preview dialog does not revoke the newly opened tab.
    const tabUrl = URL.createObjectURL(blobState.blob);
    window.open(tabUrl, "_blank", "noopener,noreferrer");
  };

  const downloadFile = async () => {
    if (!file.hasFile) return;
    setDownloading(true);
    try {
      const blob = blobState?.blob ?? (await fetchBlob(downloadPath));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo descargar.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="truncate pr-8">{file.name}</DialogTitle>
        <DialogDescription>
          {file.formatLabel} · {formatBytes(file.sizeBytes)}
          {file.charCount > 0
            ? ` · ${formatNumber(file.charCount)} caracteres extraídos`
            : ""}
          {isLegacyPdf
            ? ". Este PDF se subió antes de guardar el archivo original; reemplázalo para ver la vista previa visual."
            : textActive && kind === "text"
              ? ". Si falta contenido, vuelve a exportar el archivo o usa otro formato."
              : ""}
        </DialogDescription>
      </DialogHeader>

      {hasTabs ? (
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === "visual" || value === "text") setActiveTab(value);
          }}
        >
          <TabsList className="h-9">
            <TabsTrigger value="visual" className="px-3 text-xs">
              <EyeIcon className="size-3.5" />
              Vista previa
            </TabsTrigger>
            <TabsTrigger value="text" className="px-3 text-xs">
              <FileTextIcon className="size-3.5" />
              Texto extraído
            </TabsTrigger>
          </TabsList>
        </Tabs>
      ) : null}

      {visualActive ? (
        kind === "image" ? (
          <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-xl bg-muted/60 p-4">
            {blobLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : blobError ? (
              <p className="text-sm text-destructive">{blobError}</p>
            ) : blobUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={blobUrl}
                alt={file.name}
                className="max-h-[min(60vh,calc(100dvh-16rem))] max-w-full rounded-lg object-contain"
              />
            ) : null}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl bg-muted/60">
            {blobLoading ? (
              <div className="p-4">
                <Skeleton className="h-[min(68vh,calc(100dvh-16rem))] min-h-64 w-full rounded-lg" />
              </div>
            ) : blobError ? (
              <div className="p-4">
                <p className="text-sm text-destructive">{blobError}</p>
              </div>
            ) : blobUrl && isIOS ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                  <FileTypeIcon className="size-5 text-red-600" />
                </span>
                <p className="max-w-full truncate text-sm font-medium">
                  {file.name}
                </p>
                <p className="max-w-xs text-[13px] text-pretty text-muted-foreground">
                  En iOS, abre el PDF en el visor del sistema para ver todas las
                  páginas y hacer zoom.
                </p>
                <Button type="button" onClick={openInNewTab}>
                  <ExternalLinkIcon />
                  Abrir PDF
                </Button>
              </div>
            ) : blobUrl ? (
              <iframe
                src={blobUrl}
                title={file.name}
                className="h-[min(68vh,calc(100dvh-16rem))] min-h-64 w-full rounded-xl border border-border/60 bg-white"
              />
            ) : null}
          </div>
        )
      ) : textActive ? (
        <div className="max-h-[min(60vh,calc(100dvh-16rem))] overflow-y-auto rounded-xl bg-muted p-4">
          {textQuery.data ? (
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {textQuery.data.file.text}
            </pre>
          ) : textQuery.isError ? (
            <p className="text-sm text-destructive">
              {textQuery.error.message}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
        </div>
      ) : null}

      {file.hasFile ? (
        <DialogFooter>
          {blobState?.blob ? (
            <Button type="button" variant="outline" onClick={openInNewTab}>
              <ExternalLinkIcon />
              Abrir en nueva pestaña
            </Button>
          ) : null}
          <Button
            variant="outline"
            disabled={downloading}
            onClick={() => void downloadFile()}
          >
            {downloading ? <Spinner /> : <DownloadIcon />}
            Descargar
          </Button>
        </DialogFooter>
      ) : null}
    </>
  );
}
