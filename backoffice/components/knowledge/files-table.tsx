"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  EllipsisVerticalIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  PresentationIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes, formatNumber, formatRelative } from "@/lib/format";
import { useDeleteKnowledgeFile, useUploadKnowledgeFile } from "@/lib/queries";
import type { KnowledgeFile } from "@/lib/types";

function FormatIcon({ format }: { format: string }) {
  if (["xlsx", "xls", "ods", "csv"].includes(format))
    return <FileSpreadsheetIcon className="size-4 text-emerald-600" />;
  if (format === "pptx")
    return <PresentationIcon className="size-4 text-orange-600" />;
  if (format === "pdf") return <FileTypeIcon className="size-4 text-red-600" />;
  return <FileTextIcon className="size-4 text-primary" />;
}

export function FilesTable({
  files,
  accept,
  onPreview,
}: {
  files: KnowledgeFile[];
  accept: string[];
  onPreview: (file: KnowledgeFile) => void;
}) {
  const replaceInput = useRef<HTMLInputElement>(null);
  const [replacing, setReplacing] = useState<KnowledgeFile | null>(null);
  const [deleting, setDeleting] = useState<KnowledgeFile | null>(null);
  const upload = useUploadKnowledgeFile();
  const remove = useDeleteKnowledgeFile();

  return (
    <>
      <ul className="divide-y">
        {files.map((file) => (
          <li
            key={file.id}
            className="relative grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-3 transition-colors hover:bg-muted/40 @3xl/content:grid-cols-[2.25rem_minmax(0,1fr)_8rem_11rem_auto] @3xl/content:gap-x-5"
          >
            <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/40">
              <FormatIcon format={file.format} />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <button
                type="button"
                onClick={() => onPreview(file)}
                className="flex min-w-0 items-center gap-2 text-left text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
              >
                <span className="truncate">{file.name}</span>
                {upload.isPending && replacing?.id === file.id ? (
                  <Spinner className="size-3.5 shrink-0" />
                ) : null}
              </button>
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {file.formatLabel} · {formatBytes(file.sizeBytes)}
                <span className="@3xl/content:hidden">
                  {" "}
                  · {formatNumber(file.charCount)} caracteres
                </span>
              </span>
            </div>
            <span className="hidden text-right text-sm tabular-nums @3xl/content:block">
              {formatNumber(file.charCount)}
              <span className="block text-xs text-muted-foreground">
                caracteres
              </span>
            </span>
            <span className="hidden min-w-0 text-right text-sm text-muted-foreground @3xl/content:block">
              {formatRelative(file.updatedAt)}
              {file.uploadedBy ? (
                <span className="block truncate text-xs">
                  {file.uploadedBy}
                </span>
              ) : null}
            </span>
            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Acciones para ${file.name}`}
                    />
                  }
                >
                  <EllipsisVerticalIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-44">
                  <DropdownMenuItem onClick={() => onPreview(file)}>
                    <EyeIcon />
                    Ver texto
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setReplacing(file);
                      replaceInput.current?.click();
                    }}
                  >
                    <RefreshCwIcon />
                    Reemplazar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleting(file)}
                  >
                    <Trash2Icon />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>

      <input
        ref={replaceInput}
        type="file"
        hidden
        accept={accept.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          const target = replacing;
          if (!file || !target) return;
          upload.mutate(
            { file, replaceId: target.id },
            {
              onSuccess: () => toast.success(`Reemplazaste "${target.name}".`),
              onError: (error) => toast.error(error.message),
              onSettled: () => setReplacing(null),
            },
          );
        }}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar &quot;{deleting?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El asistente deja de usar este archivo desde la próxima respuesta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                const target = deleting;
                if (!target) return;
                remove.mutate(target.id, {
                  onSuccess: () => {
                    toast.success(`Eliminaste "${target.name}".`);
                    setDeleting(null);
                  },
                  onError: (error) => toast.error(error.message),
                });
              }}
            >
              {remove.isPending ? <Spinner /> : null}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
