"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  BotIcon,
  CheckCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  ContactIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  LayoutTemplateIcon,
  MapPinIcon,
  MicIcon,
  StickerIcon,
  UserRoundIcon,
  VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDayLabel, formatTime } from "@/lib/format";
import { useFetchBlob } from "@/lib/queries";
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

const SAFE_INLINE_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function MessageMedia({
  threadId,
  message,
  right,
}: {
  threadId: string;
  message: ChatMessage;
  right: boolean;
}) {
  const fetchBlob = useFetchBlob();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const media = message.media;
  const hasMedia = Boolean(media);
  const mime = media?.mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const isImage = SAFE_INLINE_IMAGE_MIMES.has(mime);
  const path = `/internal/threads/${threadId}/messages/${message.id}/media`;

  useEffect(() => {
    if (!hasMedia || !isImage) return;
    let active = true;
    let objectUrl: string | null = null;
    void fetchBlob(path)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [hasMedia, isImage, fetchBlob, path]);

  if (!media) return null;

  const download = async () => {
    setDownloading(true);
    try {
      const blob = await fetchBlob(path);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = media.fileName ?? "archivo";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5_000);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el archivo.",
      );
    } finally {
      setDownloading(false);
    }
  };

  if (isImage && imageUrl) {
    return (
      <div className="mb-1.5 overflow-hidden rounded-xl">
        <a
          href={imageUrl}
          target="_blank"
          rel="noreferrer"
          className="block"
          title={media.fileName ?? "Abrir imagen"}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={media.fileName ?? "Imagen adjunta"}
            className="max-h-64 max-w-full rounded-xl object-contain"
          />
        </a>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void download()}
      disabled={downloading}
      className={cn(
        "mb-1.5 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-opacity hover:opacity-85",
        right
          ? "bg-white/15 text-bubble-foreground"
          : "bg-muted text-foreground",
      )}
    >
      <FileIcon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {media.fileName ?? "Archivo adjunto"}
      </span>
      <DownloadIcon className="size-3.5 shrink-0 opacity-75" />
    </button>
  );
}

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
      <CheckCheckIcon className="size-3.5 text-[#00a87e]" aria-label="Leído" />
    );
  if (status === "delivered")
    return <CheckCheckIcon className="size-3.5" aria-label="Entregado" />;
  return <CheckIcon className="size-3.5" aria-label="Enviado" />;
}

function Bubble({
  threadId,
  message,
  continued,
  showDelivery,
  rightSide,
}: {
  threadId?: string;
  message: ChatMessage;
  /** Same side as the message before it: tighter spacing, no tail. */
  continued: boolean;
  showDelivery: boolean;
  rightSide: ChatMessage["direction"];
}) {
  const outbound = message.direction === "outbound";
  // The right side is "ours": the accent bubble. The panel's own messages, or the lead's in the test chat.
  const right = message.direction === rightSide;
  const meta =
    message.type === "text"
      ? null
      : message.type === "audio" && message.body
        ? { label: "Nota de voz (transcripción)", icon: <MicIcon /> }
        : TYPE_META[message.type];
  return (
    <div
      className={cn(
        "flex max-w-[85%] flex-col gap-1 sm:max-w-[70%]",
        right ? "items-end self-end" : "items-start self-start",
        continued ? "mt-2" : "mt-4",
      )}
    >
      <div
        className={cn(
          "rounded-[20px] px-4 py-2.5 text-sm leading-relaxed",
          right
            ? "bg-bubble text-bubble-foreground"
            : "bg-card ring-1 ring-border/60 dark:bg-secondary dark:ring-0",
          !continued && (right ? "rounded-tr-md" : "rounded-tl-md"),
          message.status === "failed" &&
            "ring-2 ring-destructive/60 dark:ring-2",
        )}
      >
        {meta ? (
          <div
            className={cn(
              "mb-1 flex items-center gap-1.5 text-xs font-medium [&_svg]:size-3.5",
              right ? "opacity-80" : "text-muted-foreground",
            )}
          >
            {meta.icon}
            {meta.label}
          </div>
        ) : null}
        {threadId && message.media ? (
          <MessageMedia threadId={threadId} message={message} right={right} />
        ) : null}
        {message.body ? (
          <p className="wrap-break-word whitespace-pre-wrap">
            {renderWhatsapp(message.body)}
          </p>
        ) : null}
        {!message.body && !meta && !message.media ? (
          <p
            className={cn(
              "italic",
              right ? "opacity-80" : "text-muted-foreground",
            )}
          >
            (sin texto)
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-1 px-1 text-[11px] text-muted-foreground tabular-nums">
        {outbound ? <Author sentBy={message.sentBy} /> : null}
        {formatTime(message.sentAt)}
        {outbound && showDelivery ? (
          <DeliveryStatus status={message.status} />
        ) : null}
      </div>
      {message.status === "failed" && message.error ? (
        <p className="max-w-full px-1 text-right text-[11px] wrap-break-word text-destructive">
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

export function ChatTranscript({
  threadId,
  messages,
  after,
  children,
  showDelivery = true,
  rightSide = "outbound",
}: {
  threadId?: string;
  messages: ChatMessage[];
  /**
   * Which direction sits on the right. The panel writes as the company, so outbound by default;
   * in the test chat the person plays the lead, so their (inbound) messages go right.
   */
  rightSide?: ChatMessage["direction"];
  /** WhatsApp's sent/delivered/read ticks. The test chat sends nothing, so it has none. */
  showDelivery?: boolean;
  /** Shown under a message's bubble (the test chat's notes). */
  after?: (message: ChatMessage) => React.ReactNode;
  /** Shown after the last message (the test chat's "Escribiendo…"). */
  children?: React.ReactNode;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const count = messages.length;
  // A reply can replace "Escribiendo…" in the same render that adds it, leaving the count as is.
  const trailing = Boolean(children);

  // Scroll only the transcript's own box: scrollIntoView would also move the page.
  useEffect(() => {
    const scroller = bottom.current?.closest("[data-chat-scroll]");
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [count, trailing]);

  const days = messages.map((message) => formatDayLabel(message.sentAt));
  return (
    <div className="flex flex-col px-3 pt-2 pb-5 lg:px-5">
      {messages.map((message, index) => {
        const day = days[index]!;
        const showDay = index === 0 || days[index - 1] !== day;
        const continued =
          !showDay && messages[index - 1]?.direction === message.direction;
        return (
          <Fragment key={message.id}>
            {showDay ? (
              <div className="mt-5 mb-1 flex justify-center">
                <span className="rounded-full bg-card px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/60 dark:bg-secondary dark:ring-0">
                  {day}
                </span>
              </div>
            ) : null}
            <Bubble
              threadId={threadId}
              message={message}
              continued={continued}
              showDelivery={showDelivery}
              rightSide={rightSide}
            />
            {after?.(message)}
          </Fragment>
        );
      })}
      {children}
      <div ref={bottom} />
    </div>
  );
}
