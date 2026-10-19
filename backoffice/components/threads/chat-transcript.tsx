"use client";

import { Fragment, useEffect, useRef } from "react";
import {
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
  VideoIcon,
} from "lucide-react";
import { formatDayLabel, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

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
      <CheckCheckIcon className="size-3.5 text-sky-600" aria-label="Leído" />
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
        "flex",
        outbound ? "justify-end" : "justify-start",
        continued ? "mt-1" : "mt-3",
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-3.5 py-2 text-sm sm:max-w-[70%]",
          outbound
            ? "border-primary/10 bg-primary/[0.07] text-foreground"
            : "bg-card shadow-xs",
          !continued && (outbound ? "rounded-tr-md" : "rounded-tl-md"),
          message.status === "failed" && "border-destructive/40",
        )}
      >
        {meta ? (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
            {meta.icon}
            {meta.label}
          </div>
        ) : null}
        {message.body ? (
          <p className="break-words whitespace-pre-wrap">{message.body}</p>
        ) : null}
        {!message.body && !meta ? (
          <p className="text-muted-foreground italic">(sin texto)</p>
        ) : null}
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground tabular-nums">
          {formatTime(message.sentAt)}
          {outbound ? <DeliveryStatus status={message.status} /> : null}
        </div>
      </div>
    </div>
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
