"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Panel, StatusPill } from "@/components/panel";
import { ChatTranscript } from "@/components/threads/chat-transcript";
import { LeadDetails } from "@/components/threads/lead-details";
import { StatusBadge } from "@/components/threads/status-badge";
import { ThreadActions } from "@/components/threads/thread-actions";
import { ThreadAlerts } from "@/components/threads/thread-alerts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

function ReplyWindow({
  closesAt,
}: {
  closesAt: Thread["replyWindowClosesAt"];
}) {
  if (!closesAt || new Date(closesAt) <= new Date())
    return <StatusPill tone="muted">Ventana de 24 h cerrada</StatusPill>;
  const day = formatDayLabel(closesAt);
  const when = day === "Hoy" ? "hoy" : day === "Ayer" ? "ayer" : "mañana";
  return (
    <StatusPill tone="ok">
      Puede responder hasta {when} {formatTime(closesAt)}
    </StatusPill>
  );
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const query = useThread(id);

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
  return (
    <div className="@container/content flex flex-col gap-4 px-4 lg:px-6">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {back}
        {thread ? (
          <>
            <Avatar className="size-9">
              <AvatarFallback className="text-xs">
                {initials(thread.name ?? thread.phone.slice(-2))}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate text-lg leading-tight font-semibold tracking-tight">
                  {thread.name ?? formatPhone(thread.phone)}
                </h2>
                <StatusBadge thread={thread} />
              </div>
              <p className="truncate text-[13px] text-muted-foreground tabular-nums">
                {formatPhone(thread.phone)}
                {thread.source === "form" ? " · Llegó por un formulario" : ""}
              </p>
            </div>
            <ThreadActions thread={thread} />
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

      {thread ? <ThreadAlerts thread={thread} /> : null}

      <div className="grid items-start gap-4 @4xl/content:grid-cols-[minmax(0,1fr)_19rem]">
        <Panel
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
            className="h-[calc(100svh-15rem)] min-h-96 overflow-y-auto bg-muted/20"
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
        </Panel>
        {thread ? (
          <LeadDetails thread={thread} />
        ) : (
          <Skeleton className="h-96 w-full rounded-xl" />
        )}
      </div>
    </div>
  );
}
