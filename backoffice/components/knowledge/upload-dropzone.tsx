"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useUploadKnowledgeFile } from "@/lib/queries";
import { cn } from "@/lib/utils";

type UploadStatus = {
  id: number;
  name: string;
  state: "uploading" | "done" | "error";
  message?: string;
};

let nextId = 0;

export type UploadQueue = ReturnType<typeof useUploadQueue>;

/** Uploads picked or dropped files and keeps the last few outcomes on screen. */
export function useUploadQueue(accept: string[]) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadKnowledgeFile();
  const [statuses, setStatuses] = useState<UploadStatus[]>([]);

  const update = (id: number, patch: Partial<UploadStatus>) =>
    setStatuses((current) =>
      current.map((status) =>
        status.id === id ? { ...status, ...patch } : status,
      ),
    );

  async function uploadAll(files: File[]) {
    const queued = files.map((file) => ({
      id: nextId++,
      name: file.name,
      state: "uploading" as const,
    }));
    setStatuses((current) => [...queued, ...current].slice(0, 12));
    // One at a time, so each upload is checked against the space the previous ones used.
    for (const [index, file] of files.entries()) {
      const id = queued[index]!.id;
      try {
        const result = await upload.mutateAsync({ file });
        update(id, {
          state: "done",
          message: result.replaced
            ? "Reemplazó a la versión anterior"
            : "Subido",
        });
      } catch (error) {
        update(id, {
          state: "error",
          message: error instanceof Error ? error.message : "No se pudo subir",
        });
      }
    }
  }

  return {
    statuses,
    uploadAll,
    pick: () => input.current?.click(),
    dismiss: (id: number) =>
      setStatuses((current) => current.filter((item) => item.id !== id)),
    input: (
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept={accept.join(",")}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) void uploadAll(files);
        }}
      />
    ),
  };
}

/** Lets files be dropped anywhere on its children, with an overlay while dragging. */
export function DropTarget({
  queue,
  children,
}: {
  queue: UploadQueue;
  children: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div
      className="relative"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.length > 0) void queue.uploadAll(files);
      }}
    >
      {children}
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 backdrop-blur-[1px]">
          <span className="flex items-center gap-2 rounded-full bg-background px-3 py-1.5 text-sm font-medium shadow-sm">
            <UploadIcon className="size-4 text-primary" />
            Soltá para subir
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function EmptyDropzone({ queue }: { queue: UploadQueue }) {
  return (
    <button
      type="button"
      onClick={queue.pick}
      className="m-3 flex w-[calc(100%-1.5rem)] flex-col items-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 px-6 py-12 text-center transition-colors outline-none hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="flex size-10 items-center justify-center rounded-lg border bg-background text-muted-foreground shadow-xs">
        <UploadIcon className="size-4" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Subí la ficha de proyectos y las preguntas frecuentes
        </span>
        <span className="text-[13px] text-muted-foreground">
          Arrastrá los archivos acá o hacé clic para elegirlos. PDF, Word,
          Excel, PowerPoint, CSV, texto o Markdown.
        </span>
      </span>
    </button>
  );
}

export function UploadRows({ queue }: { queue: UploadQueue }) {
  if (queue.statuses.length === 0) return null;
  return (
    <ul className="divide-y bg-muted/20">
      {queue.statuses.map((status) => (
        <li key={status.id} className="flex items-center gap-3 px-5 py-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center">
            {status.state === "uploading" ? (
              <Spinner className="size-4 text-muted-foreground" />
            ) : status.state === "done" ? (
              <CircleCheckIcon className="size-4 text-emerald-600" />
            ) : (
              <CircleAlertIcon className="size-4 text-destructive" />
            )}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium">{status.name}</span>
            <span
              className={cn(
                "text-xs",
                status.state === "error"
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {status.state === "uploading" ? "Subiendo…" : status.message}
            </span>
          </span>
          {status.state !== "uploading" ? (
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Quitar de la lista"
              onClick={() => queue.dismiss(status.id)}
            >
              <XIcon />
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
