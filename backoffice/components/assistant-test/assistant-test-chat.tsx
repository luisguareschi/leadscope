"use client";

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type KeyboardEvent,
} from "react";
import {
  CircleAlertIcon,
  OctagonPauseIcon,
  MessagesSquareIcon,
  PaperclipIcon,
  SendHorizontalIcon,
  UserRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { ChatTranscript } from "@/components/threads/chat-transcript";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { TestChatMessage } from "@/lib/assistant-test-storage";
import { needsHumanReasonLabel } from "@/lib/thread-status";
import type { ChatMessage } from "@/lib/types";

/** WhatsApp's limit for one text message. Mirrors the backend. */
const MAX_CHARS = 4096;

const TOUCH_QUERY = "(hover: none) and (pointer: coarse)";

function subscribeTouch(onChange: () => void) {
  const query = window.matchMedia(TOUCH_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function toChatMessage(message: TestChatMessage): ChatMessage {
  return {
    id: message.id,
    direction: message.role === "lead" ? "inbound" : "outbound",
    type: "text",
    body: message.body,
    status: null,
    error: null,
    sentAt: message.sentAt,
    sentBy: null,
    media: null,
  };
}

function ModelReplyNote({ text }: { text: string }) {
  return (
    <details className="mt-1 max-w-[85%] self-start px-1 text-xs text-muted-foreground sm:max-w-[70%]">
      <summary className="cursor-pointer select-none">
        Ver respuesta original del modelo
      </summary>
      <p className="mt-1 rounded-xl bg-card px-3 py-2 whitespace-pre-wrap ring-1 ring-border/60 dark:bg-secondary dark:ring-0">
        {text}
      </p>
    </details>
  );
}

function TypingBubble() {
  return (
    <div
      role="status"
      className="mt-4 inline-flex items-center gap-2 self-start rounded-[20px] rounded-tl-md bg-card px-4 py-2.5 text-sm text-muted-foreground ring-1 ring-border/60 dark:bg-secondary dark:ring-0"
    >
      <Spinner className="size-3.5" aria-hidden aria-label={undefined} />
      Escribiendo…
    </div>
  );
}

/** Before the first message: what the test is, and the lead's WhatsApp name. */
function EmptyState({
  leadName,
  onLeadNameChange,
}: {
  leadName: string;
  onLeadNameChange: (name: string) => void;
}) {
  const initial = leadName.trim().charAt(0).toUpperCase();
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessagesSquareIcon className="size-6" />
        </div>
        <h2 className="mt-4 font-heading text-base font-semibold">
          Inicia una conversación
        </h2>
        <p className="mt-1 text-sm text-balance text-muted-foreground">
          Usa la configuración y los archivos guardados. No envía mensajes ni
          sincroniza con HubSpot.
        </p>

        <label
          htmlFor="assistant-test-lead-name"
          className="mt-6 flex w-full cursor-text items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-border/60 transition-shadow focus-within:ring-2 focus-within:ring-ring/40 dark:ring-0"
        >
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground"
          >
            {initial || <UserRoundIcon className="size-5" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs text-muted-foreground">
              Nombre en WhatsApp · opcional
            </span>
            <input
              id="assistant-test-lead-name"
              value={leadName}
              maxLength={80}
              autoComplete="off"
              placeholder="Lead de prueba"
              onChange={(event) => onLeadNameChange(event.target.value)}
              className="w-full min-w-0 bg-transparent text-base font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground/70 md:text-sm"
            />
          </span>
        </label>
      </div>
    </div>
  );
}

/** The test conversation and its composer. The person playing the lead writes here. */
export function AssistantTestChat({
  messages,
  pending,
  stopped,
  error,
  leadName,
  onLeadNameChange,
  draft,
  onDraftChange,
  onSend,
  onContinue,
  onReset,
  className,
}: {
  messages: TestChatMessage[];
  pending: boolean;
  stopped: boolean;
  error: { message: string; code?: string } | null;
  leadName: string;
  onLeadNameChange: (name: string) => void;
  /** The composer's text, held by the panel so it survives other pages and failed sends. */
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (body: string) => Promise<boolean>;
  onContinue: () => void;
  onReset: () => void;
  className?: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  // A phone keyboard has no Shift+Enter: there Enter is a new line and the button sends.
  const touch = useSyncExternalStore(
    subscribeTouch,
    () => window.matchMedia(TOUCH_QUERY).matches,
    () => false,
  );
  const text = draft.trim();
  const tooLong = text.length > MAX_CHARS;
  const disabled = pending || stopped;
  const canSend = !disabled && text.length > 0 && !tooLong;
  const byId = new Map(messages.map((message) => [message.id, message]));
  const scroller = useRef<HTMLDivElement>(null);

  // The stop buttons and an error take room from the transcript: keep its end in view.
  useEffect(() => {
    const box = scroller.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [stopped, error]);

  const submit = () => {
    if (!canSend) return;
    void onSend(text).then(() =>
      requestAnimationFrame(() => {
        // The composer lost focus while disabled; take it back only if nothing else has it now.
        const active = document.activeElement;
        if (!active || active === document.body || active === input.current)
          input.current?.focus();
      }),
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey && !touch) {
      event.preventDefault();
      submit();
    }
  };

  const notes = (message: ChatMessage) => {
    const test = byId.get(message.id);
    if (!test || test.role !== "assistant") return null;
    return (
      <>
        {test.sentFiles && test.sentFiles.length > 0 ? (
          <div className="mt-1.5 flex max-w-[85%] flex-wrap gap-1.5 self-start sm:max-w-[70%]">
            {test.sentFiles.map((file) => (
              <span
                key={file.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border/60 dark:bg-secondary dark:ring-0"
              >
                <PaperclipIcon className="size-3 shrink-0" />
                Enviaría:{" "}
                <span className="font-medium text-foreground">{file.path}</span>
              </span>
            ))}
          </div>
        ) : null}
        {test.modelReply ? <ModelReplyNote text={test.modelReply} /> : null}
        {test.stoppedReason ? (
          <div className="mt-2 flex max-w-[85%] items-start gap-2 self-start rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] leading-relaxed sm:max-w-[70%]">
            <OctagonPauseIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              En producción, el asistente se detendría aquí.{" "}
              <span className="text-muted-foreground">
                {needsHumanReasonLabel(test.stoppedReason)}
              </span>
            </span>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-border/60 dark:ring-0",
        className,
      )}
    >
      <div
        ref={scroller}
        data-chat-scroll
        className="min-h-0 flex-1 overflow-y-auto bg-muted/70 dark:bg-black/25"
      >
        {messages.length === 0 ? (
          <EmptyState leadName={leadName} onLeadNameChange={onLeadNameChange} />
        ) : (
          <ChatTranscript
            messages={messages.map(toChatMessage)}
            after={notes}
            showDelivery={false}
            rightSide="inbound"
          >
            {pending ? <TypingBubble /> : null}
          </ChatTranscript>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-border/70 px-3 py-2.5 lg:px-4 lg:py-3">
        {error ? (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertDescription>
              {error.message}
              {error.code === "anthropic_missing" ? (
                <>
                  {" "}
                  <Link
                    href="/settings?tab=anthropic"
                    className="font-medium underline underline-offset-2"
                  >
                    Ir a Anthropic
                  </Link>
                </>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {stopped ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={onContinue}>
              Continuar conversación
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onReset}>
              Nueva conversación
            </Button>
          </div>
        ) : null}
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border border-transparent bg-input p-1.5 pl-0 transition-[color,box-shadow,border-color] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
            disabled && "opacity-60",
          )}
        >
          <Textarea
            ref={input}
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={stopped || pending}
            rows={1}
            enterKeyHint={touch ? "enter" : "send"}
            aria-label="Mensaje del lead"
            placeholder={
              stopped ? "Asistente detenido" : "Escribe un mensaje de prueba…"
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
            {pending ? (
              <Spinner aria-label="Enviando" />
            ) : (
              <SendHorizontalIcon />
            )}
          </Button>
        </div>
        {/* On touch there is no hint, so the row only shows when the message is too long. */}
        {touch && !tooLong ? null : (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {touch ? null : "Enter para enviar · Shift+Enter nueva línea"}
            </span>
            {tooLong ? (
              <span className="text-destructive tabular-nums">
                {text.length} / {MAX_CHARS} caracteres
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
