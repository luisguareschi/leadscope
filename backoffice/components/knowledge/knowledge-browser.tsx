"use client";

import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
} from "react";
import { toast } from "sonner";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  ArrowRightLeftIcon,
  ChevronRightIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  FolderIcon,
  FolderOpenIcon,
  FolderPlusIcon,
  HouseIcon,
  PencilIcon,
  PresentationIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
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
import {
  buildKnowledgeTree,
  describeContents,
  placeLabel,
  type KnowledgeTree,
} from "@/lib/knowledge-tree";
import {
  useCreateKnowledgeFolder,
  useDeleteKnowledgeFile,
  useDeleteKnowledgeFolder,
  useUpdateKnowledgeFile,
  useUpdateKnowledgeFolder,
  useUploadKnowledgeFile,
} from "@/lib/queries";
import type {
  KnowledgeFile,
  KnowledgeFolder,
  KnowledgeList,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { MoveDialog, type MoveRequest } from "./move-dialog";
import { NameDialog, splitExtension, type NameRequest } from "./name-dialog";
import { rowMotion } from "./row-motion";
import {
  EmptyDropzone,
  UploadRows,
  type UploadQueue,
  type UploadTarget,
} from "./upload-dropzone";

const COLLAPSED_KEY = "leadscope.knowledge.collapsed";
const ITEM_TYPE = "application/x-leadscope-knowledge";
/** Hovering a closed folder this long while dragging opens it. */
const OPEN_ON_HOVER_MS = 650;

type Row =
  | { kind: "folder"; folder: KnowledgeFolder; depth: number }
  | { kind: "file"; file: KnowledgeFile; depth: number }
  | { kind: "empty"; folderId: string; depth: number };

/** Where a drag would land: a folder id, or null for the root. Undefined is nowhere. */
type DropTarget = string | null | undefined;

function FormatIcon({ format }: { format: string }) {
  if (["xlsx", "xls", "ods", "csv"].includes(format))
    return <FileSpreadsheetIcon className="size-4 text-emerald-600" />;
  if (format === "pptx")
    return <PresentationIcon className="size-4 text-orange-600" />;
  if (format === "pdf") return <FileTypeIcon className="size-4 text-red-600" />;
  return <FileTextIcon className="size-4 text-primary" />;
}

function readCollapsed(): Set<string> {
  try {
    const stored = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
}

/** Folders first, then files, each by name; a closed folder hides what is inside it. */
function visibleRows(tree: KnowledgeTree, collapsed: Set<string>): Row[] {
  const rows: Row[] = [];
  const walk = (folderId: string | null, depth: number) => {
    for (const folder of tree.childFolders(folderId)) {
      rows.push({ kind: "folder", folder, depth });
      if (collapsed.has(folder.id)) continue;
      const before = rows.length;
      walk(folder.id, depth + 1);
      if (rows.length === before)
        rows.push({ kind: "empty", folderId: folder.id, depth: depth + 1 });
    }
    for (const file of tree.childFiles(folderId))
      rows.push({ kind: "file", file, depth });
  };
  walk(null, 0);
  return rows;
}

/** The folder a row drops into: the folder itself, or the one a file (or empty note) sits in. */
function rowFolder(row: Row): string | null {
  if (row.kind === "folder") return row.folder.id;
  if (row.kind === "empty") return row.folderId;
  return row.file.folderId;
}

const rowGrid =
  "relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 py-3 pr-5 pl-[calc(1.25rem+var(--depth)*0.75rem)] transition-colors @3xl/content:grid-cols-[auto_minmax(0,1fr)_8rem_11rem_auto] @3xl/content:gap-x-5 @3xl/content:pl-[calc(1.25rem+var(--depth)*1.5rem)]";

export function KnowledgeBrowser({
  data,
  accept,
  queue,
  onPreview,
}: {
  data: KnowledgeList;
  accept: string[];
  queue: UploadQueue;
  onPreview: (file: KnowledgeFile) => void;
}) {
  const tree = useMemo(
    () => buildKnowledgeTree(data.folders, data.files),
    [data.folders, data.files],
  );
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [moveRequest, setMoveRequest] = useState<MoveRequest | null>(null);
  const [deletingFile, setDeletingFile] = useState<KnowledgeFile | null>(null);
  const [deletingFolder, setDeletingFolder] = useState<KnowledgeFolder | null>(
    null,
  );
  const [replacing, setReplacing] = useState<KnowledgeFile | null>(null);
  const [dragged, setDragged] = useState<MoveRequest | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(undefined);
  const draggedRef = useRef<MoveRequest | null>(null);
  const openTimer = useRef<{ id: string; timer: number } | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const createFolder = useCreateKnowledgeFolder();
  const updateFolder = useUpdateKnowledgeFolder();
  const removeFolder = useDeleteKnowledgeFolder();
  const updateFile = useUpdateKnowledgeFile();
  const removeFile = useDeleteKnowledgeFile();
  const upload = useUploadKnowledgeFile();

  const rows = visibleRows(tree, collapsed);

  const setOpen = (folderId: string, open: boolean) =>
    setCollapsed((current) => {
      if (current.has(folderId) !== open) return current;
      const next = new Set(current);
      if (open) next.delete(folderId);
      else next.add(folderId);
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...next]));
      return next;
    });

  const openPath = (folderId: string | null) => {
    let current = folderId;
    while (current) {
      setOpen(current, true);
      current = tree.folders.get(current)?.parentId ?? null;
    }
  };

  const target = (folderId: string | null): UploadTarget => ({
    folderId,
    place: folderId ? placeLabel(tree, folderId) : null,
  });

  const askNewFolder = (parentId: string | null) =>
    setNameRequest({
      title: "Nueva carpeta",
      description: parentId
        ? `Dentro de ${placeLabel(tree, parentId)}.`
        : "En la raíz de Conocimiento.",
      label: "Nombre",
      initial: "",
      placeholder: "Por ejemplo: Tres Cruces",
      submitLabel: "Crear carpeta",
      onSubmit: async (name) => {
        await createFolder.mutateAsync({ name, parentId });
        openPath(parentId);
        toast.success(`Creaste la carpeta "${name}".`);
      },
    });

  const askRenameFolder = (folder: KnowledgeFolder) =>
    setNameRequest({
      title: "Renombrar carpeta",
      label: "Nombre",
      initial: folder.name,
      submitLabel: "Guardar",
      onSubmit: async (name) => {
        await updateFolder.mutateAsync({ id: folder.id, name });
        toast.success(`La carpeta ahora se llama "${name}".`);
      },
    });

  const askRenameFile = (file: KnowledgeFile) => {
    const [base, extension] = splitExtension(file.name);
    setNameRequest({
      title: "Renombrar archivo",
      description:
        "La extensión se mantiene. Para subir una versión nueva, usa Reemplazar.",
      label: "Nombre",
      initial: base,
      extension,
      submitLabel: "Guardar",
      onSubmit: async (name) => {
        const { file: saved } = await updateFile.mutateAsync({
          id: file.id,
          name,
        });
        toast.success(`El archivo ahora se llama "${saved.name}".`);
      },
    });
  };

  const move = async (request: MoveRequest, to: string | null) => {
    if (to === request.from) return;
    try {
      if (request.kind === "file")
        await updateFile.mutateAsync({ id: request.id, folderId: to });
      else await updateFolder.mutateAsync({ id: request.id, parentId: to });
      openPath(to);
      toast.success(`Moviste "${request.name}" a ${placeLabel(tree, to)}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo mover.");
      throw error;
    }
  };

  const deleteFolder = (folder: KnowledgeFolder) => {
    removeFolder.mutate(folder.id, {
      onSuccess: (result) => {
        toast.success(
          result.deletedFiles > 0
            ? `Eliminaste "${folder.name}" y ${result.deletedFiles} ${result.deletedFiles === 1 ? "archivo" : "archivos"}.`
            : `Eliminaste la carpeta "${folder.name}".`,
        );
        setDeletingFolder(null);
      },
      onError: (error) => toast.error(error.message),
    });
  };

  // Drag and drop: rows and the root header carry `data-drop-folder`; the list works out the target.
  const canDrop = (to: string | null, item: MoveRequest | null) => {
    if (!item) return true;
    if (to === item.from) return false;
    return !(item.kind === "folder" && tree.isSameOrInside(item.id, to));
  };

  const clearOpenTimer = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current.timer);
    openTimer.current = null;
  };

  const endDrag = () => {
    clearOpenTimer();
    draggedRef.current = null;
    setDragged(null);
    setDropTarget(undefined);
  };

  const targetOf = (event: DragEvent): string | null => {
    const element = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-drop-folder]",
    );
    return element?.dataset.dropFolder || null;
  };

  const onDragOver = (event: DragEvent) => {
    const files = event.dataTransfer.types.includes("Files");
    const item = draggedRef.current;
    if (!files && !item) return;
    const to = targetOf(event);
    if (!canDrop(to, files ? null : item)) {
      clearOpenTimer();
      setDropTarget(undefined);
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = files ? "copy" : "move";
    setDropTarget(to);
    if (to && collapsed.has(to)) {
      if (openTimer.current?.id !== to) {
        clearOpenTimer();
        openTimer.current = {
          id: to,
          timer: window.setTimeout(() => setOpen(to, true), OPEN_ON_HOVER_MS),
        };
      }
    } else clearOpenTimer();
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const to = targetOf(event);
    const files = Array.from(event.dataTransfer.files);
    const item = draggedRef.current;
    endDrag();
    if (files.length > 0) {
      openPath(to);
      void queue.uploadAll(files, target(to));
    } else if (item && canDrop(to, item)) {
      void move(item, to).catch(() => {});
    }
  };

  const startDrag = (event: DragEvent, item: MoveRequest) => {
    draggedRef.current = item;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(ITEM_TYPE, item.id);
    event.dataTransfer.setData("text/plain", item.name);
    // Changing the DOM inside dragstart cancels the drag in some browsers.
    requestAnimationFrame(() => setDragged(item));
  };

  const dragging = dragged !== null || dropTarget !== undefined;
  const inTarget = (folderId: string | null) =>
    typeof dropTarget === "string" && tree.isSameOrInside(dropTarget, folderId);
  const fileCount = data.files.length;
  const folderCount = data.folders.length;

  return (
    <MotionConfig reducedMotion="user">
      <div
        className={cn(
          "relative divide-y divide-border/70 overflow-hidden rounded-xl bg-card ring-1 ring-border/60 dark:ring-0 transition-shadow",
          dropTarget === null && "ring-2 ring-primary dark:ring-2",
        )}
        onDragOver={onDragOver}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null))
            setDropTarget(undefined);
        }}
        onDrop={onDrop}
      >
        <div
          data-drop-folder=""
          className={cn(
            "flex min-h-12 items-center justify-between gap-3 px-5 py-2.5 transition-colors",
            dropTarget === null && "bg-primary/10",
          )}
        >
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <HouseIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Conocimiento</span>
            <span className="hidden truncate text-muted-foreground tabular-nums @md/content:inline">
              · {formatNumber(fileCount)}{" "}
              {fileCount === 1 ? "archivo" : "archivos"}
              {folderCount > 0
                ? ` en ${formatNumber(folderCount)} ${folderCount === 1 ? "carpeta" : "carpetas"}`
                : ""}
            </span>
          </div>
          {dragging ? (
            <span
              className={cn(
                "flex h-8 shrink-0 items-center text-xs animate-in fade-in",
                dropTarget === null
                  ? "font-medium text-primary"
                  : "text-muted-foreground",
              )}
            >
              {dragged
                ? "Suelta aquí para moverlo a la raíz"
                : "Suelta para subir a la raíz"}
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 animate-in fade-in"
              onClick={() => askNewFolder(null)}
            >
              <FolderPlusIcon />
              Nueva carpeta
            </Button>
          )}
        </div>

        <UploadRows queue={queue} />

        {rows.length === 0 ? (
          <div data-drop-folder="">
            <EmptyDropzone queue={queue} />
          </div>
        ) : (
          <ul className="divide-y">
            <AnimatePresence initial={false}>
              {rows.map((row) => {
                const folderId = rowFolder(row);
                const highlighted = inTarget(folderId);
                const style = { "--depth": row.depth } as CSSProperties;
                if (row.kind === "empty") {
                  return (
                    <motion.li
                      key={`empty-${row.folderId}`}
                      {...rowMotion}
                      className="overflow-hidden"
                    >
                      <div
                        data-drop-folder={row.folderId}
                        style={style}
                        className={cn(
                          rowGrid,
                          "py-2.5 text-xs text-muted-foreground",
                          highlighted && "bg-primary/5",
                        )}
                      >
                        <span className="w-14" />
                        <span className="col-span-2 @3xl/content:col-span-4">
                          Carpeta vacía. Arrastra archivos aquí o usa Subir
                          archivos aquí en su menú.
                        </span>
                      </div>
                    </motion.li>
                  );
                }
                if (row.kind === "folder") {
                  const { folder } = row;
                  const open = !collapsed.has(folder.id);
                  const stats = tree.stats(folder.id);
                  const isTarget = dropTarget === folder.id;
                  const item: MoveRequest = {
                    kind: "folder",
                    id: folder.id,
                    name: folder.name,
                    from: folder.parentId,
                  };
                  return (
                    <motion.li
                      key={folder.id}
                      {...rowMotion}
                      className="overflow-hidden"
                    >
                      <div
                        data-drop-folder={folder.id}
                        draggable
                        onDragStart={(event) => startDrag(event, item)}
                        onDragEnd={endDrag}
                        style={style}
                        className={cn(
                          rowGrid,
                          "hover:bg-muted",
                          highlighted && "bg-primary/5 hover:bg-primary/5",
                          isTarget && "ring-2 ring-primary ring-inset",
                          dragged?.id === folder.id && "opacity-50",
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <ChevronRightIcon
                            aria-hidden
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              open && "rotate-90",
                            )}
                          />
                          <span className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                            {open ? (
                              <FolderOpenIcon className="size-4 text-primary" />
                            ) : (
                              <FolderIcon className="size-4 text-primary" />
                            )}
                          </span>
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpen(folder.id, !open)}
                            className="min-w-0 truncate text-left text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                          >
                            {folder.name}
                          </button>
                          <span className="truncate text-xs text-muted-foreground tabular-nums">
                            {isTarget && !dragged ? (
                              <span className="font-medium text-primary">
                                Suelta para subir aquí
                              </span>
                            ) : isTarget ? (
                              <span className="font-medium text-primary">
                                Suelta para mover aquí
                              </span>
                            ) : (
                              <>
                                {describeContents(stats)}
                                <span className="@3xl/content:hidden">
                                  {" "}
                                  · {formatNumber(stats.chars)} caracteres
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                        <span className="hidden text-right text-sm tabular-nums @3xl/content:block">
                          {formatNumber(stats.chars)}
                          <span className="block text-xs text-muted-foreground">
                            caracteres
                          </span>
                        </span>
                        <span className="hidden @3xl/content:block" />
                        <div className="relative">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Acciones para la carpeta ${folder.name}`}
                                />
                              }
                            >
                              <EllipsisVerticalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="min-w-48"
                            >
                              <DropdownMenuItem
                                onClick={() => queue.pick(target(folder.id))}
                              >
                                <UploadIcon />
                                Subir archivos aquí
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => askNewFolder(folder.id)}
                              >
                                <FolderPlusIcon />
                                Nueva subcarpeta
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => askRenameFolder(folder)}
                              >
                                <PencilIcon />
                                Renombrar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setMoveRequest(item)}
                              >
                                <ArrowRightLeftIcon />
                                Mover a…
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() =>
                                  stats.files === 0 && stats.folders === 0
                                    ? deleteFolder(folder)
                                    : setDeletingFolder(folder)
                                }
                              >
                                <Trash2Icon />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </motion.li>
                  );
                }
                const { file } = row;
                const item: MoveRequest = {
                  kind: "file",
                  id: file.id,
                  name: file.name,
                  from: file.folderId,
                };
                return (
                  <motion.li
                    key={file.id}
                    {...rowMotion}
                    className="overflow-hidden"
                  >
                    <div
                      data-drop-folder={file.folderId ?? ""}
                      draggable
                      onDragStart={(event) => startDrag(event, item)}
                      onDragEnd={endDrag}
                      style={style}
                      className={cn(
                        rowGrid,
                        "hover:bg-muted",
                        highlighted && "bg-primary/5 hover:bg-primary/5",
                        dragged?.id === file.id && "opacity-50",
                      )}
                    >
                      <span className="flex items-center gap-1">
                        <span aria-hidden className="size-4" />
                        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <FormatIcon format={file.format} />
                        </span>
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
                              onClick={() => askRenameFile(file)}
                            >
                              <PencilIcon />
                              Renombrar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setMoveRequest(item)}
                            >
                              <ArrowRightLeftIcon />
                              Mover a…
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
                              onClick={() => setDeletingFile(file)}
                            >
                              <Trash2Icon />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <input
        ref={replaceInput}
        type="file"
        hidden
        accept={accept.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          const current = replacing;
          if (!file || !current) return;
          upload.mutate(
            { file, replaceId: current.id },
            {
              onSuccess: () => toast.success(`Reemplazaste "${current.name}".`),
              onError: (error) => toast.error(error.message),
              onSettled: () => setReplacing(null),
            },
          );
        }}
      />

      <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
      <MoveDialog
        tree={tree}
        request={moveRequest}
        onMove={move}
        onClose={() => setMoveRequest(null)}
      />

      <AlertDialog
        open={deletingFile !== null}
        onOpenChange={(open) => !open && setDeletingFile(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ¿Eliminar &quot;{deletingFile?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              El asistente deja de usar este archivo desde la próxima respuesta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={removeFile.isPending}
              onClick={() => {
                const current = deletingFile;
                if (!current) return;
                removeFile.mutate(current.id, {
                  onSuccess: () => {
                    toast.success(`Eliminaste "${current.name}".`);
                    setDeletingFile(null);
                  },
                  onError: (error) => toast.error(error.message),
                });
              }}
            >
              {removeFile.isPending ? <Spinner /> : null}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DeleteFolderDialog
        tree={tree}
        folder={deletingFolder}
        pending={removeFolder.isPending}
        onConfirm={deleteFolder}
        onClose={() => setDeletingFolder(null)}
      />
    </MotionConfig>
  );
}

function DeleteFolderDialog({
  tree,
  folder,
  pending,
  onConfirm,
  onClose,
}: {
  tree: KnowledgeTree;
  folder: KnowledgeFolder | null;
  pending: boolean;
  onConfirm: (folder: KnowledgeFolder) => void;
  onClose: () => void;
}) {
  const stats = folder ? tree.stats(folder.id) : null;
  const files = stats?.files ?? 0;
  const filesLabel = `${formatNumber(files)} ${files === 1 ? "archivo" : "archivos"}`;
  return (
    <AlertDialog
      open={folder !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            ¿Eliminar la carpeta &quot;{folder?.name}&quot;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {stats && files > 0 ? (
              <>
                Tiene <strong className="text-foreground">{filesLabel}</strong>
                {stats.folders > 0
                  ? ` en total, contando ${stats.folders === 1 ? "su subcarpeta" : `sus ${stats.folders} subcarpetas`}`
                  : ""}
                . Se eliminan con la carpeta y el asistente deja de usarlos
                desde la próxima respuesta. No se puede deshacer.
              </>
            ) : (
              <>
                No tiene archivos, solo{" "}
                {stats?.folders === 1
                  ? "una subcarpeta vacía"
                  : `${stats?.folders ?? 0} subcarpetas vacías`}
                , que se eliminan con ella.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => folder && onConfirm(folder)}
          >
            {pending ? <Spinner /> : null}
            {files > 0
              ? `Eliminar carpeta y ${filesLabel}`
              : "Eliminar carpeta"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
