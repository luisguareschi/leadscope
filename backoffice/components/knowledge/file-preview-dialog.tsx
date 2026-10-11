"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/format";
import { useKnowledgeFileText } from "@/lib/queries";
import type { KnowledgeFile } from "@/lib/types";

export function FilePreviewDialog({ file, onClose }: { file: KnowledgeFile | null; onClose: () => void }) {
  const query = useKnowledgeFileText(file?.id ?? null);
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file?.name}</DialogTitle>
          <DialogDescription>
            Este es el texto que lee el asistente ({formatNumber(file?.charCount ?? 0)} caracteres). Si falta algo o se ve
            desordenado, exportá el archivo de nuevo o pasalo a otro formato.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-md border bg-muted/40 p-4">
          {query.data ? (
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">{query.data.file.text}</pre>
          ) : query.isError ? (
            <p className="text-sm text-destructive">{query.error.message}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
