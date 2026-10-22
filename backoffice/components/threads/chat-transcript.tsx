"use client";

import { Fragment, useEffect, useRef } from "react";
import {
  BotIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  ContactIcon,
  FileIcon,
  ImageIcon,
  LayoutTemplateIcon,
  MapPinIcon,
  MicIcon,
  StickerIcon,
  UserRoundIcon,
  VideoIcon,
} from "lucide-react";
import { formatDayLabel, formatTime } from "@/lib/format";
import { operatorName } from "@/lib/thread-status";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";
import { renderWhatsapp } from "@/lib/whatsapp-format";

const TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  audio: { label: "Audio", icon: <MicIcon /> },
  image: { label: "Imagen", icon: <ImageIcon /> },
  video: { label: "Video", icon: <VideoIcon /> },
  document: { label: "Documento", icon: <FileIcon /> },
  sticker: { label: "Sticker", icon: <StickerIcon /> },
  location: { label: "Ubicación", icon: <MapPinIcon /> },
  contacts: { label: "Contacto", icon: <ContactIcon /> },
  template: { label: "Plantilla de bienvenida", icon: <LayoutTemplateIcon /> },
};

function DeliveryStatus({ status }: { status: string | null }) {
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <CircleAlertIcon className="size-3.5" />
        No enviado
      </span>
    );
  }
  if (status === "read")
    return (
      <CheckCheckIcon
        className="size-3.5 text-emerald-600"
        aria-label="Leído"
      />
    );
  if (status === "delivered")
    return <CheckCheckIcon className="size-3.5" aria-label="Entregado" />;
  return <CheckIcon className="size-3.5" aria-label="Enviado" />;
}

function Bubble({
  message,
  continued,
}: {
  message: ChatMessage;
  /** Same side as the message before it: tighter spacing, no tail. */
  continued: boolean;
}) {
  const outbound = message.direction === "outbound";
  const meta = message.type === "text" ? null : TYPE_META[message.type];
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]",
        outbound ? "items-end self-end" : "items-start self-start",
        continued ? "mt-2" : "mt-4",
      )}
    >
      <div
        className={cn(
          "rounded-2xl border px-3.5 py-2 text-sm",
          outbound
            ? "border-primary/10 bg-primary/80 text-primary-foreground"
            : "bg-card shadow-xs",
          !continued && (outbound ? "rounded-tr-md" : "rounded-tl-md"),
          message.status === "failed" && "border-destructive/40",
        )}
      >
        {meta ? (
          <div
            className={cn(
              "mb-1 flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5",
              outbound ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {meta.icon}
            {meta.label}
          </div>
        ) : null}
        {message.body ? (
          <p className="break-words whitespace-pre-wrap">
            {renderWhatsapp(message.body)}
          </p>
        ) : null}
        {!message.body && !meta ? (
          <p
            className={cn(
              "italic",
              outbound ? "opacity-80" : "text-muted-foreground",
            )}
          >
            (sin texto)
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-1 px-1 text-[11px] text-muted-foreground tabular-nums">
        {outbound ? <Author sentBy={message.sentBy} /> : null}
        {formatTime(message.sentAt)}
        {outbound ? <DeliveryStatus status={message.status} /> : null}
      </div>
      {message.status === "failed" && message.error ? (
        <p className="max-w-full px-1 text-right text-[11px] break-words text-destructive">
          {message.error}
        </p>
      ) : null}
    </div>
  );
}

/** Who wrote an outbound message: the assistant, or the person who sent it from the panel. */
function Author({ sentBy }: { sentBy: ChatMessage["sentBy"] }) {
  if (!sentBy) {
    return (
      <span className="inline-flex items-center gap-1">
        <BotIcon className="size-3" />
        Asistente ·
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 font-medium text-foreground/80"
      title={sentBy.email}
    >
      <UserRoundIcon className="size-3" />
      Enviado por{" "}
      {sentBy.support
        ? `${sentBy.email} (administrador)`
        : operatorName(sentBy.email)}{" "}
      ·
    </span>
  );
}

export function ChatTranscript({ messages }: { messages: ChatMessage[] }) {
  const bottom = useRef<HTMLDivElement>(null);
  const count = messages.length;

  // Scroll only the transcript's own box: scrollIntoView would also move the page.
  useEffect(() => {
    const scroller = bottom.current?.closest("[data-chat-scroll]");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [count]);

  const days = messages.map((message) => formatDayLabel(message.sentAt));
  return (
    <div className="flex flex-col px-5 pt-2 pb-5">
      {messages.map((message, index) => {
        const day = days[index]!;
        const showDay = index === 0 || days[index - 1] !== day;
        const continued =
          !showDay && messages[index - 1]?.direction === message.direction;
        return (
          <Fragment key={message.id}>
            {showDay ? (
              <div className="mt-4 mb-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {day}
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null}
            <Bubble message={message} continued={continued} />
          </Fragment>
        );
      })}
      <div ref={bottom} />
    </div>
  );
}
