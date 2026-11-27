"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Button as LiquidButton } from "@onlymoein/liquidglass";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "cn";
import { Panel, StatusDot, StatusPill, type Tone } from "@/components/panel";
import { ChatTranscript } from "@/components/threads/chat-transcript";
import { LeadAvatar } from "@/components/threads/lead-avatar";
import { LeadDetails } from "@/components/threads/lead-details";
import { MessageComposer } from "@/components/threads/message-composer";
import {
  BotBadge,
  StageBadge,
  WroteAgainBadge,
} from "@/components/threads/status-badge";
import { ThreadActions } from "@/components/threads/thread-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LiquidSegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/lib/format";
import { useMe, useThread } from "@/lib/queries";
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
        WhatsApp permite responder durante 24 horas desde el último mensaje del
        lead.
      </TooltipContent>
    </Tooltip>
  );
}

type MobileView = "chat" | "lead";

/** The Lead tab's dot below lg: the panel has something to act on. */
function attentionTone(thread: Thread | undefined): Tone | null {
  if (!thread) return null;
  if (thread.crm?.status === "failed") return "error";
  if (thread.needsHuman) return "warning";
  return null;
}

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useThread(id);
  const me = useMe();
  const [view, setView] = useState<MobileView>("chat");
  // Below lg this page hides the site header, and with it the company-wide pause button.
  const companyPaused = me.data?.company?.assistantPaused === true;

  const back = (
    <LiquidButton
      type="button"
      variant="glass"
      icon={<ChevronLeftIcon className="size-5" />}
      className="!size-9 !rounded-full max-lg:!size-10"
      aria-label="Volver a Conversaciones"
      onClick={() => router.push("/threads")}
    />
  );

  if (query.isError) {
    const missing =
      query.error instanceof ApiError && query.error.status === 404;
    return (
      <div className="flex flex-col gap-4 px-4 max-lg:px-3 max-lg:pt-[max(0.5rem,var(--header-safe-top))] lg:px-6">
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
    // Below lg there is no site header above, so this page clears the notch itself.
    <div className="@container/content flex min-h-0 flex-1 flex-col gap-2.5 pt-[max(0.5rem,var(--header-safe-top))] lg:gap-4 lg:px-6 lg:pt-0">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1.5 max-lg:px-3 lg:gap-x-3 lg:gap-y-2">
        {back}
        {thread ? (
          <>
            <LeadAvatar
              thread={thread}
              className="size-10 [--avatar-ring:var(--background)] max-sm:hidden"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="truncate font-heading text-lg leading-tight font-semibold tracking-tight lg:text-xl">
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
                {thread.source === "form" ? " · Formulario" : ""}
              </p>
            </div>
            <ThreadActions thread={thread} />
            <div className="flex w-full flex-wrap items-center gap-1.5 lg:hidden">
              {companyPaused ? (
                <StatusPill
                  tone="error"
                  className="bg-destructive/10 text-destructive"
                >
                  Asistente pausado en la empresa
                </StatusPill>
              ) : null}
              <StageBadge stage={thread.stage} />
              <BotBadge activity={thread.botActivity} />
              <WroteAgainBadge thread={thread} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
        )}
      </header>

      <div className="max-lg:px-3 lg:hidden">
        <LiquidSegmentedControl
          aria-label="Vista de conversación"
          value={view}
          onValueChange={(value) => setView(value as MobileView)}
          className="w-full"
          items={[
            { value: "chat", label: "Conversación" },
            {
              value: "lead",
              label: (
                <span className="inline-flex items-center gap-1.5">
                  Lead
                  {attention ? (
                    <StatusDot
                      tone={attention}
                      aria-label="Requiere atención"
                      className="size-1.5"
                    />
                  ) : null}
                </span>
              ),
            },
          ]}
        />
      </div>

      {/*
        Below md the shell is exactly one screen, so the row takes what is left. From md the shell
        only has a max height: a basis taller than any screen makes the row shrink to fit it.
      */}
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 md:flex-[1_1_100svh] lg:grid-cols-2">
        <Panel
          className={cn(
            "flex min-h-0 flex-col max-lg:rounded-none max-lg:border-t max-lg:border-border/70 max-lg:ring-0",
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
            className="min-h-0 flex-1 overflow-y-auto bg-muted/70 dark:bg-black/25"
          >
            {data ? (
              <ChatTranscript
                threadId={data.thread.id}
                messages={data.messages}
              />
            ) : (
              <div className="flex flex-col gap-3 p-5">
                <Skeleton className="h-12 w-2/3 rounded-[20px]" />
                <Skeleton className="ml-auto h-16 w-2/3 rounded-[20px]" />
                <Skeleton className="h-10 w-1/2 rounded-[20px]" />
              </div>
            )}
          </div>
          {thread ? <MessageComposer key={thread.id} thread={thread} /> : null}
        </Panel>
        {thread && data ? (
          <LeadDetails
            thread={thread}
            fields={data.fields}
            className={cn(
              "max-lg:mx-3 max-lg:mb-[max(1rem,var(--safe-bottom))]",
              view !== "lead" && "max-lg:hidden",
            )}
          />
        ) : (
          <Skeleton
            className={cn(
              "h-full w-full rounded-xl max-lg:mx-3 max-lg:mb-[max(1rem,var(--safe-bottom))] max-lg:w-auto",
              view !== "lead" && "max-lg:hidden",
            )}
          />
        )}
      </div>
    </div>
  );
}
