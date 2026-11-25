"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import {
  BoldIcon,
  ClockIcon,
  FileTextIcon,
  FolderOpenIcon,
  ItalicIcon,
  PaperclipIcon,
  SendHorizontalIcon,
  StrikethroughIcon,
  TimerOffIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatBytes } from "@/lib/format";
import { useKnowledgeFiles, useMe, useSendMessage } from "@/lib/queries";
import type { KnowledgeFile, Thread } from "@/lib/types";
import { toggleMarker, type WhatsappMarker } from "@/lib/whatsapp-format";

/** WhatsApp's limit for one text message. Mirrors the backend. */
const MAX_CHARS = 4096;
const MAX_CAPTION_CHARS = 1024;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

type PendingAttachment =
  { kind: "upload"; file: File } | { kind: "knowledge"; file: KnowledgeFile };

const FORMATS: Array<{
  marker: WhatsappMarker;
  label: string;
  key: string;
  shift: boolean;
  icon: React.ReactNode;
}> = [
  { marker: "*", label: "Negrita", key: "b", shift: false, icon: <BoldIcon /> },
  {
    marker: "_",
    label: "Cursiva",
    key: "i",
    shift: false,
    icon: <ItalicIcon />,
  },
  {
    marker: "~",
    label: "Tachado",
    key: "x",
    shift: true,
    icon: <StrikethroughIcon />,
  },
];

/** "23 h 10 min", "12 min". */
function remaining(ms: number): string {
  const minutes = Math.max(1, Math.floor(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const noSubscription = () => () => {};

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

function subscribeTouch(onChange: () => void) {
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Writes text or sends files (direct upload or public Conocimiento files) to the lead from the
 * company's WhatsApp number. Sending pauses the assistant and assigns an unassigned thread.
 */
export function MessageComposer({ thread }: { thread: Thread }) {
  const me = useMe();
  const knowledge = useKnowledgeFiles();
  const send = useSendMessage(thread.id);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const isMac = useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
  // A phone keyboard has no Shift+Enter: there Enter is a new line and the button sends.
  const touch = useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
  const input = useRef<HTMLTextAreaElement>(null);
  const now = useNow(30_000);

  const publicFiles = useMemo(() => {
    const foldersById = new Map(
      (knowledge.data?.folders ?? []).map((folder) => [folder.id, folder]),
    );
    const folderPathOf = (folderId: string | null): string => {
      const parts: string[] = [];
      let current = folderId;
      const seen = new Set<string>();
      while (current && !seen.has(current)) {
        seen.add(current);
        const folder = foldersById.get(current);
        if (!folder) break;
        parts.unshift(folder.name);
        current = folder.parentId;
      }
      return parts.join(" / ");
    };
    return (knowledge.data?.files ?? [])
      .filter((file) => file.visibility === "public" && file.hasFile)
      .map((file) => ({
        file,
        folderPath: folderPathOf(file.folderId),
      }));
  }, [knowledge.data?.files, knowledge.data?.folders]);

  const closesAt = thread.replyWindowClosesAt
    ? new Date(thread.replyWindowClosesAt).getTime()
    : null;
  const open = closesAt !== null && closesAt > now;
  const left = closesAt !== null ? closesAt - now : 0;
  const text = draft.trim();
  const maxChars = attachment ? MAX_CAPTION_CHARS : MAX_CHARS;
  const tooLong = text.length > maxChars;
  const canSend =
    open &&
    (text.length > 0 || attachment !== null) &&
    !tooLong &&
    !send.isPending;

  const shortcut = (key: string, shift: boolean) =>
    `${isMac ? "⌘" : "Ctrl+"}${shift ? (isMac ? "⇧" : "Shift+") : ""}${key.toUpperCase()}`;

  const applyFormat = (marker: WhatsappMarker) => {
    const element = input.current;
    if (!element) return;
    const next = toggleMarker(
      element.value,
      element.selectionStart,
      element.selectionEnd,
      marker,
    );
    setDraft(next.value);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(next.start, next.end);
    });
  };

  const submit = () => {
    if (!canSend) return;
    const wasActive = !thread.paused || thread.needsHuman;
    const payload =
      attachment?.kind === "upload"
        ? { body: text, file: attachment.file }
        : attachment?.kind === "knowledge"
          ? { body: text, knowledgeFileId: attachment.file.id }
          : text;
    send.mutate(payload, {
      onSuccess: ({ message }) => {
        setDraft("");
        setAttachment(null);
        if (message.status === "failed") {
          toast.error(
            `WhatsApp no envió el mensaje${message.error ? `: ${message.error}` : "."}`,
          );
        } else if (wasActive) {
          toast.success(
            "Mensaje enviado. Asistente pausado en esta conversación.",
          );
        }
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey && !touch) {
      event.preventDefault();
      submit();
      return;
    }
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const format = FORMATS.find(
      (item) =>
        item.key === event.key.toLowerCase() && item.shift === event.shiftKey,
    );
    if (format) {
      event.preventDefault();
      applyFormat(format.marker);
    }
  };

  const takesAssignee =
    thread.assignee === null && me.data ? !me.data.supportAccess : false;
  const hint = !open
    ? null
    : thread.paused && !thread.needsHuman
      ? "Asistente pausado en esta conversación."
      : `Al enviar, el asistente se pausa${takesAssignee ? " y se te asigna la conversación" : ""}.`;

  return (
    <div className="flex flex-col gap-2 bg-card px-4 py-3">
      {!open ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-xl bg-muted px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground"
        >
          <TimerOffIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {thread.lastInboundAt
              ? "Han pasado más de 24 horas desde el último mensaje del lead. Podrás responder cuando vuelva a escribir."
              : "El lead aún no ha respondido. Podrás escribirle desde aquí cuando envíe un mensaje."}
          </span>
        </p>
      ) : null}
      <div
        className={cn(
          "flex flex-col rounded-2xl border border-transparent bg-input transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
          !open && "opacity-60",
        )}
      >
        <div className="flex items-center gap-0.5 border-b border-border/70 px-2 py-1">
          {FORMATS.map((format) => (
            <Tooltip key={format.marker}>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="max-lg:size-8"
                    aria-label={`${format.label} (${shortcut(format.key, format.shift)})`}
                    disabled={!open}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyFormat(format.marker)}
                  />
                }
              >
                {format.icon}
              </TooltipTrigger>
              <TooltipContent>
                {format.label} · {shortcut(format.key, format.shift)} ·{" "}
                <span className="font-mono">
                  {format.marker}texto{format.marker}
                </span>
              </TooltipContent>
            </Tooltip>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="max-lg:size-8"
                  aria-label="Adjuntar archivo"
                  disabled={!open || send.isPending}
                />
              }
            >
              <PaperclipIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-56">
              <DropdownMenuItem onClick={() => fileInput.current?.click()}>
                <UploadIcon />
                Subir desde tu equipo
              </DropdownMenuItem>
              {publicFiles.length > 0 ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FolderOpenIcon className="size-3.5" />
                      Archivos públicos de Conocimiento
                    </DropdownMenuLabel>
                    <div className="max-h-64 overflow-y-auto">
                      {publicFiles.map(({ file, folderPath }) => (
                        <DropdownMenuItem
                          key={file.id}
                          onClick={() =>
                            setAttachment({ kind: "knowledge", file })
                          }
                        >
                          <FileTextIcon className="shrink-0" />
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">{file.name}</span>
                            {folderPath ? (
                              <span className="truncate text-[11px] text-muted-foreground">
                                {folderPath}
                              </span>
                            ) : null}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  </DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          {touch ? null : (
            <span className="ml-auto px-1.5 text-[11px] text-muted-foreground max-sm:hidden">
              Enter para enviar · Shift+Enter nueva línea
            </span>
          )}
        </div>
        {attachment ? (
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2 text-xs">
            <FileTextIcon className="size-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {attachment.file.name}
            </span>
            <span className="shrink-0 text-muted-foreground tabular-nums">
              {formatBytes(
                attachment.kind === "upload"
                  ? attachment.file.size
                  : attachment.file.sizeBytes,
              )}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Quitar adjunto"
              onClick={() => setAttachment(null)}
            >
              <XIcon />
            </Button>
          </div>
        ) : null}
        <div className="flex items-end gap-2 p-1.5 pl-0">
          <Textarea
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={!open}
            rows={1}
            enterKeyHint={touch ? "enter" : "send"}
            aria-label="Mensaje para el lead"
            placeholder={
              !open
                ? "Ventana de 24 h cerrada"
                : attachment
                  ? "Agrega un comentario (opcional)…"
                  : "Escribe un mensaje…"
            }
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent py-1.5 shadow-none focus-visible:ring-0 max-lg:max-h-28"
          />
          <Button
            type="button"
            size="icon-sm"
            className="max-lg:size-9"
            aria-label="Enviar"
            disabled={!canSend}
            onClick={submit}
          >
            {send.isPending ? <Spinner /> : <SendHorizontalIcon />}
          </Button>
        </div>
      </div>
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        onChange={(event) => {
          const picked = event.target.files?.[0];
          event.target.value = "";
          if (!picked) return;
          if (picked.size > MAX_FILE_BYTES) {
            toast.error("El archivo supera el máximo de 15 MB.");
            return;
          }
          setAttachment({ kind: "upload", file: picked });
        }}
      />
      {open ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{hint}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular-nums",
              left < 60 * 60_000 && "text-primary",
              tooLong && "text-destructive",
            )}
            title="WhatsApp permite enviar mensajes libres durante 24 horas desde el último mensaje del lead."
          >
            {tooLong ? (
              `${text.length} / ${maxChars} caracteres`
            ) : (
              <>
                <ClockIcon className="size-3.5" />
                Quedan {remaining(left)} para responder
              </>
            )}
          </span>
        </div>
      ) : null}
    </div>
  );
}
