"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "cn";
import { Panel, StatusDot, StatusPill, type Tone } from "@/components/panel";
import { ChatTranscript } from "@/components/threads/chat-transcript";
import { LeadDetails } from "@/components/threads/lead-details";
import { MessageComposer } from "@/components/threads/message-composer";
import {
  BotBadge,
  StageBadge,
  WroteAgainBadge,
} from "@/components/threads/status-badge";
import { ThreadActions } from "@/components/threads/thread-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api";
import {
  formatDayLabel,
  formatNumber,
  formatPhone,
  formatTime,
  initials,
} from "@/lib/format";
import { useThread } from "@/lib/queries";
import type { Thread } from "@/lib/types";

function windowClosed(closesAt: Thread["replyWindowClosesAt"]): boolean {
  return !closesAt || new Date(closesAt) <= new Date();
}

function ReplyWindow({
  closesAt,
}: {
  closesAt: Thread["replyWindowClosesAt"];
}) {
  const closed = windowClosed(closesAt);
  let label = "Ventana de 24 h cerrada";
  if (!closed && closesAt) {
    const day = formatDayLabel(closesAt);
    const when = day === "Hoy" ? "hoy" : day === "Ayer" ? "ayer" : "mañana";
    label = `Puede responder hasta ${when} ${formatTime(closesAt)}`;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <StatusPill tone={closed ? "muted" : "ok"}>{label}</StatusPill>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        WhatsApp deja responder hasta 24 horas después del último mensaje del
        lead. Después, ni el asistente ni el panel pueden escribirle hasta que
        el lead vuelva a escribir.
      </TooltipContent>
    </Tooltip>
  );
}

type MobileView = "chat" | "lead";

/** The Lead tab's dot below lg: the panel has something to act on. */
function attentionTone(thread: Thread | undefined): Tone | null {
  if (!thread) return null;
  if (thread.crm.status === "failed") return "error";
  if (thread.needsHuman) return "warning";
  return null;
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const query = useThread(id);
  const [view, setView] = useState<MobileView>("chat");

  const back = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Volver a Conversaciones"
      nativeButton={false}
      render={<Link href="/threads" />}
    >
      <ArrowLeftIcon />
    </Button>
  );

  if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-4 px-4 lg:px-6">
        <div>{back}</div>
        <Alert variant={missing ? "default" : "destructive"}>
          <AlertTitle>
            {missing
              ? "Esta conversación no existe"
              : "No se pudo cargar la conversación"}
          </AlertTitle>
          <AlertDescription>
            {missing ? "Puede que la hayan eliminado." : query.error.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const data = query.data;
  const thread = data?.thread;
  const attention = attentionTone(thread);
  return (
    // Fills the panel's scroll area exactly: each column scrolls inside itself, never the page.
    <div className="@container/content flex min-h-0 flex-1 flex-col gap-4 px-4 lg:px-6">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {back}
        {thread ? (
          <>
            <Avatar className="size-9 max-sm:hidden">
              <AvatarFallback className="text-xs">
                {initials(thread.name ?? thread.phone.slice(-2))}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-lg leading-tight font-semibold tracking-tight">
                  {thread.name ?? formatPhone(thread.phone)}
                </h2>
                <span className="contents max-lg:hidden">
                  <StageBadge stage={thread.stage} />
                  <BotBadge activity={thread.botActivity} />
                  <WroteAgainBadge thread={thread} />
                </span>
              </div>
              <p className="truncate text-[13px] text-muted-foreground tabular-nums">
                {formatPhone(thread.phone)}
                {thread.source === "form" ? " · Llegó por un formulario" : ""}
              </p>
            </div>
            <ThreadActions thread={thread} />
            <div className="flex w-full flex-wrap items-center gap-1.5 lg:hidden">
              <StageBadge stage={thread.stage} />
              <BotBadge activity={thread.botActivity} />
              <WroteAgainBadge thread={thread} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
        )}
      </header>

      <Tabs
        value={view}
        onValueChange={(value) => setView(value as MobileView)}
        className="lg:hidden"
      >
        <TabsList className="w-full">
          <TabsTrigger value="chat">Conversación</TabsTrigger>
          <TabsTrigger value="lead">
            Lead
            {attention ? (
              <StatusDot
                tone={attention}
                aria-label="Hay algo para resolver"
                className="size-1.5"
              />
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* A basis taller than any screen, so the row always shrinks to the space that is left. */}
      <div className="grid min-h-0 flex-[1_1_100svh] grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Panel
          className={cn(
            "flex min-h-0 flex-col",
            view !== "chat" && "max-lg:hidden",
          )}
          headerClassName="max-lg:hidden"
          title="Conversación"
          description={
            data
              ? data.messages.length === 1
                ? "1 mensaje"
                : `${formatNumber(data.messages.length)} mensajes`
              : undefined
          }
          actions={
            thread ? (
              <ReplyWindow closesAt={thread.replyWindowClosesAt} />
            ) : null
          }
        >
          <div
            data-chat-scroll
            className="min-h-0 flex-1 overflow-y-auto bg-muted/20"
          >
            {data ? (
              <ChatTranscript messages={data.messages} />
            ) : (
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-12 w-2/3 rounded-2xl" />
                <Skeleton className="ml-auto h-16 w-2/3 rounded-2xl" />
                <Skeleton className="h-10 w-1/2 rounded-2xl" />
              </div>
            )}
          </div>
          {thread ? <MessageComposer thread={thread} /> : null}
        </Panel>
        {thread && data ? (
          <LeadDetails
            thread={thread}
            fields={data.fields}
            className={cn(view !== "lead" && "max-lg:hidden")}
          />
        ) : (
          <Skeleton
            className={cn(
              "h-full w-full rounded-xl",
              view !== "lead" && "max-lg:hidden",
            )}
          />
        )}
      </div>
    </div>
  );
}
