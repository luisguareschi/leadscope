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
  if (status === "read") return <CheckCheckIcon className="size-3.5 text-sky-600" aria-label="Leído" />;
  if (status === "delivered") return <CheckCheckIcon className="size-3.5" aria-label="Entregado" />;
  return <CheckIcon className="size-3.5" aria-label="Enviado" />;
}

function Bubble({ message }: { message: ChatMessage }) {
  const outbound = message.direction === "outbound";
  const meta = message.type === "text" ? null : TYPE_META[message.type];
  return (
    <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-xs sm:max-w-[70%]",
          outbound ? "rounded-br-md bg-primary/10 text-foreground" : "rounded-bl-md border bg-card",
          message.status === "failed" && "ring-1 ring-destructive/40",
        )}
      >
        {meta ? (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&_svg]:size-3.5">
            {meta.icon}
            {meta.label}
          </div>
        ) : null}
        {message.body ? <p className="break-words whitespace-pre-wrap">{message.body}</p> : null}
        {!message.body && !meta ? <p className="text-muted-foreground italic">(sin texto)</p> : null}
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

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [count]);

  const days = messages.map((message) => formatDayLabel(message.sentAt));
  return (
    <div className="flex flex-col gap-2 p-4">
      {messages.map((message, index) => {
        const day = days[index]!;
        const showDay = index === 0 || days[index - 1] !== day;
        return (
          <Fragment key={message.id}>
            {showDay ? (
              <div className="my-2 flex justify-center">
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs text-muted-foreground">{day}</span>
              </div>
            ) : null}
            <Bubble message={message} />
          </Fragment>
        );
      })}
      <div ref={bottom} />
    </div>
  );
}
