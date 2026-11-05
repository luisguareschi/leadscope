"use client";

import Link from "next/link";
import { cn } from "cn";
import { useRouter } from "next/navigation";
import { ClockIcon, MessagesSquareIcon, SearchXIcon } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPhone, formatRelative, formatWaiting } from "@/lib/format";
import type { Thread } from "@/lib/types";
import { AssigneePicker } from "./assignee-picker";
import { LeadAvatar } from "./lead-avatar";
import { CrmIndicator } from "./crm-indicator";
import { StagePicker } from "./stage-picker";
import { BotBadge, ColumnHelp, WroteAgainBadge } from "./status-badge";

const HEAD = "h-10 text-xs font-medium text-muted-foreground";

export function ThreadsTable({
  threads,
  loading,
  filtered,
  queue,
}: {
  threads: Thread[];
  loading: boolean;
  filtered: boolean;
  /** Por contactar: the last column is how long each lead has waited. */
  queue: boolean;
}) {
  if (!loading && threads.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            {filtered ? <SearchXIcon /> : <MessagesSquareIcon />}
          </EmptyMedia>
          <EmptyTitle>
            {filtered
              ? "No hay conversaciones con este filtro"
              : "Todavía no hay conversaciones"}
          </EmptyTitle>
          <EmptyDescription>
            {filtered
              ? "Prueba con otra etapa u otro filtro, o busca por otro nombre o teléfono."
              : "Cuando un lead escriba al número de WhatsApp, la conversación aparecerá aquí."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    // One child for the Panel's divide-y: the table from lg up, stacked rows below.
    <div>
      <div className="px-2 pt-1 pb-2 max-lg:hidden">
        <DesktopTable threads={threads} loading={loading} queue={queue} />
      </div>
      <ul className="divide-y lg:hidden">
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <ThreadRowSkeleton key={index} />
            ))
          : threads.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} queue={queue} />
            ))}
      </ul>
    </div>
  );
}

function ThreadRowSkeleton() {
  return (
    <li className="flex gap-3 px-4 py-3.5">
      <Skeleton className="size-10 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex justify-between gap-3">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
    </li>
  );
}

/** Below lg: the same columns as the table, stacked; the whole row opens the thread. */
function ThreadRow({ thread, queue }: { thread: Thread; queue: boolean }) {
  return (
    <li className="relative flex gap-3 px-4 py-3.5 has-[a[data-row-link]:active]:bg-accent">
      <LeadAvatar thread={thread} className="size-10" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/threads/${thread.id}`}
            data-row-link
            className="truncate text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {thread.name ?? "Sin nombre"}
          </Link>
          <span
            className="ml-auto inline-flex shrink-0 items-center gap-1 pl-2 text-xs text-muted-foreground tabular-nums"
            title={
              queue ? "Esperando desde que pasó a Por contactar" : undefined
            }
          >
            {queue ? <ClockIcon className="size-3" /> : null}
            {queue
              ? formatWaiting(thread.handedOffAt)
              : formatRelative(thread.lastMessageAt)}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs text-muted-foreground tabular-nums">
            {formatPhone(thread.phone)}
          </span>
          <WroteAgainBadge thread={thread} />
        </div>
        {thread.lastMessagePreview ? (
          <p className="truncate text-[13px] text-muted-foreground">
            {thread.lastMessagePreview}
          </p>
        ) : null}
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
          {/* The pickers sit above the row's link, so their taps do not open the thread. */}
          <span className="relative z-10 flex max-w-full shrink-0 [&>button]:max-w-[calc(100%+0.5rem)]">
            <StagePicker thread={thread} size="compact" />
          </span>
          <BotBadge activity={thread.botActivity} />
          <span className="relative z-10 flex max-w-full shrink-0 [&>button]:max-w-[calc(100%+0.5rem)]">
            <AssigneePicker thread={thread} size="compact" />
          </span>
          {thread.crm && thread.crm.status !== "none" ? (
            <CrmIndicator crm={thread.crm} />
          ) : null}
        </div>
      </div>
    </li>
  );
}

function DesktopTable({
  threads,
  loading,
  queue,
}: {
  threads: Thread[];
  loading: boolean;
  queue: boolean;
}) {
  const router = useRouter();
  // A company with HubSpot off gets no HubSpot status on its threads, so the column goes.
  const hubspot = loading || threads.some((thread) => thread.crm !== null);
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD} w-[26%] pl-3`}>Lead</TableHead>
          <TableHead className={`${HEAD} w-40`}>
            <span className="flex items-center gap-1">
              Etapa
              <ColumnHelp column="stage" />
            </span>
          </TableHead>
          <TableHead className={`${HEAD} w-36`}>
            <span className="flex items-center gap-1">
              Asistente
              <ColumnHelp column="bot" />
            </span>
          </TableHead>
          <TableHead className={`${HEAD} hidden @5xl/content:table-cell`}>
            Último mensaje
          </TableHead>
          <TableHead className={`${HEAD} w-40`}>Asignado</TableHead>
          {hubspot ? (
            <TableHead className={`${HEAD} w-20 text-center`}>
              HubSpot
            </TableHead>
          ) : null}
          <TableHead className={`${HEAD} w-28 pr-3 text-right`}>
            {queue ? "Esperando" : "Actividad"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                <TableCell className="pl-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex flex-col gap-1.5">
                      <Skeleton className="h-3.5 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-24 rounded-full" />
                </TableCell>
                <TableCell className="hidden @5xl/content:table-cell">
                  <Skeleton className="h-3.5 w-full max-w-md" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3.5 w-20" />
                </TableCell>
                {hubspot ? <TableCell /> : null}
                <TableCell className="pr-3">
                  <Skeleton className="ml-auto h-3 w-12" />
                </TableCell>
              </TableRow>
            ))
          : threads.map((thread, index) => (
              <TableRow
                key={thread.id}
                className={cn(
                  "cursor-pointer",
                  index % 2 === 0 && "[--avatar-ring:var(--muted)] *:bg-muted",
                )}
                onClick={() => router.push(`/threads/${thread.id}`)}
              >
                <TableCell className="pl-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <LeadAvatar thread={thread} className="size-10" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={`/threads/${thread.id}`}
                          className="truncate text-sm font-medium outline-none hover:underline focus-visible:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {thread.name ?? "Sin nombre"}
                        </Link>
                        <WroteAgainBadge thread={thread} />
                      </div>
                      <span className="truncate text-xs text-muted-foreground tabular-nums">
                        {formatPhone(thread.phone)}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <StagePicker thread={thread} size="compact" />
                </TableCell>
                <TableCell>
                  <BotBadge activity={thread.botActivity} />
                </TableCell>
                <TableCell className="hidden @5xl/content:table-cell">
                  <p className="truncate text-muted-foreground">
                    {thread.lastMessagePreview ?? "—"}
                  </p>
                </TableCell>
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <AssigneePicker thread={thread} size="compact" />
                </TableCell>
                {hubspot ? (
                  <TableCell
                    className="text-center"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {thread.crm ? <CrmIndicator crm={thread.crm} /> : null}
                  </TableCell>
                ) : null}
                <TableCell className="pr-3 text-right text-xs text-muted-foreground tabular-nums">
                  {queue
                    ? formatWaiting(thread.handedOffAt)
                    : formatRelative(thread.lastMessageAt)}
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
