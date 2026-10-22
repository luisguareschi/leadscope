"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import { toast } from "sonner";
import {
  BoldIcon,
  ClockIcon,
  ItalicIcon,
  SendHorizontalIcon,
  StrikethroughIcon,
  TimerOffIcon,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useMe, useSendMessage } from "@/lib/queries";
import type { Thread } from "@/lib/types";
import { toggleMarker, type WhatsappMarker } from "@/lib/whatsapp-format";

/** WhatsApp's limit for one text message. Mirrors the backend. */
const MAX_CHARS = 4096;

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

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * Writes to the lead from the company's WhatsApp number. Sending pauses the assistant, and a thread
 * nobody has is assigned to the sender. Free-form text only inside WhatsApp's 24-hour window.
 */
export function MessageComposer({ thread }: { thread: Thread }) {
  const me = useMe();
  const send = useSendMessage(thread.id);
  const [draft, setDraft] = useState("");
  const isMac = useSyncExternalStore(
    noSubscription,
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  );
  const input = useRef<HTMLTextAreaElement>(null);
  const now = useNow(30_000);

  const closesAt = thread.replyWindowClosesAt
    ? new Date(thread.replyWindowClosesAt).getTime()
    : null;
  const open = closesAt !== null && closesAt > now;
  const left = closesAt !== null ? closesAt - now : 0;
  const text = draft.trim();
  const tooLong = text.length > MAX_CHARS;
  const canSend = open && text.length > 0 && !tooLong && !send.isPending;

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
    send.mutate(text, {
      onSuccess: ({ message }) => {
        setDraft("");
        if (message.status === "failed") {
          toast.error(
            `WhatsApp no envió el mensaje${message.error ? `: ${message.error}` : "."}`,
          );
        } else if (wasActive) {
          toast.success(
            "Mensaje enviado. El asistente quedó pausado en esta conversación.",
          );
        }
      },
      onError: (error) => toast.error(error.message),
    });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
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
      ? "El asistente está pausado: no responde hasta que lo reanuden."
      : `Al enviar, el asistente se pausa en esta conversación${takesAssignee ? " y queda asignada a vos" : ""}.`;

  return (
    <div className="flex flex-col gap-2 bg-card px-4 py-3">
      {!open ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground"
        >
          <TimerOffIcon className="mt-0.5 size-4 shrink-0" />
          <span>
            {thread.lastInboundAt
              ? "Pasaron más de 24 horas desde el último mensaje del lead. WhatsApp solo deja escribirle con una plantilla aprobada, y desde el panel todavía no se envían plantillas. Cuando el lead vuelva a escribir, vas a poder responderle desde acá."
              : "El lead todavía no escribió. WhatsApp solo deja escribirle con una plantilla aprobada hasta que escriba, y desde el panel todavía no se envían plantillas."}
          </span>
        </p>
      ) : null}
      <div
        className={cn(
          "flex flex-col rounded-lg border bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          !open && "opacity-60",
        )}
      >
        <div className="flex items-center gap-0.5 border-b px-1.5 py-1">
          {FORMATS.map((format) => (
            <Tooltip key={format.marker}>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
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
          <span className="ml-auto px-1.5 text-[11px] text-muted-foreground">
            Enter envía · Shift+Enter, nueva línea
          </span>
        </div>
        <div className="flex items-end gap-2 p-1.5 pl-0">
          <Textarea
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={!open}
            rows={1}
            aria-label="Mensaje para el lead"
            placeholder={
              open
                ? "Escribile al lead por WhatsApp…"
                : "La ventana de 24 h está cerrada"
            }
            className="max-h-40 min-h-9 resize-none border-0 bg-transparent py-1.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <Button
            type="button"
            size="icon-sm"
            aria-label="Enviar"
            disabled={!canSend}
            onClick={submit}
          >
            {send.isPending ? <Spinner /> : <SendHorizontalIcon />}
          </Button>
        </div>
      </div>
      {open ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{hint}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1 tabular-nums",
              left < 60 * 60_000 && "text-amber-700 dark:text-amber-400",
              tooLong && "text-destructive",
            )}
            title="WhatsApp deja escribir mensajes libres hasta 24 horas después del último mensaje del lead."
          >
            {tooLong ? (
              `${text.length} / ${MAX_CHARS} caracteres`
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
