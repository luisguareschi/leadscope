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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatNumber, formatRelative } from "@/lib/format";
import { useDeleteKnowledgeFile, useUploadKnowledgeFile } from "@/lib/queries";
import type { KnowledgeFile } from "@/lib/types";

function FormatIcon({ format }: { format: string }) {
  if (["xlsx", "xls", "ods", "csv"].includes(format)) return <FileSpreadsheetIcon className="size-4 text-emerald-600" />;
  if (format === "pptx") return <PresentationIcon className="size-4 text-orange-600" />;
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4 lg:pl-6">Archivo</TableHead>
            <TableHead className="hidden sm:table-cell">Formato</TableHead>
            <TableHead className="text-right">Caracteres</TableHead>
            <TableHead className="hidden text-right md:table-cell">Tamaño</TableHead>
            <TableHead className="hidden lg:table-cell">Actualizado</TableHead>
            <TableHead className="w-12 pr-4 lg:pr-6" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {files.map((file) => (
            <TableRow key={file.id}>
              <TableCell className="pl-4 lg:pl-6">
                <button
                  type="button"
                  onClick={() => onPreview(file)}
                  className="flex max-w-[22rem] items-center gap-2 text-left font-medium hover:underline"
                >
                  <FormatIcon format={file.format} />
                  <span className="truncate">{file.name}</span>
                  {upload.isPending && replacing?.id === file.id ? <Spinner className="size-3.5" /> : null}
                </button>
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{file.formatLabel}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(file.charCount)}</TableCell>
              <TableCell className="hidden text-right text-muted-foreground tabular-nums md:table-cell">
                {formatBytes(file.sizeBytes)}
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">
                {formatRelative(file.updatedAt)}
                {file.uploadedBy ? <span className="block text-xs">{file.uploadedBy}</span> : null}
              </TableCell>
              <TableCell className="pr-4 lg:pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Acciones para ${file.name}`} />}>
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
                    <DropdownMenuItem variant="destructive" onClick={() => setDeleting(file)}>
                      <Trash2Icon />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

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

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar &quot;{deleting?.name}&quot;?</AlertDialogTitle>
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
