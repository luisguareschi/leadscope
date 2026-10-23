"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClockIcon,
  FileTextIcon,
  MessagesSquareIcon,
  SearchXIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatPhone,
  formatRelative,
  formatWaiting,
  initials,
} from "@/lib/format";
import type { Thread } from "@/lib/types";
import { AssigneePicker } from "./assignee-picker";
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
              ? "Probá con otra etapa u otro filtro, o buscá por otro nombre o teléfono."
              : "Cuando un lead escriba al número de WhatsApp, la conversación aparece acá."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    // One child for the Panel's divide-y: the table from lg up, stacked rows below.
    <div>
      <div className="max-lg:hidden">
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
      <Skeleton className="size-9 shrink-0 rounded-full" />
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
    <li className="relative flex gap-3 px-4 py-3.5 has-[a[data-row-link]:active]:bg-muted/40">
      <Avatar className="size-9">
        <AvatarFallback className="text-xs">
          {initials(thread.name ?? thread.phone.slice(-2))}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/threads/${thread.id}`}
            data-row-link
            className="truncate text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
          >
            {thread.name ?? "Sin nombre"}
          </Link>
          {thread.source === "form" ? (
            <FileTextIcon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label="Llegó por un formulario"
            />
          ) : null}
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
          {thread.crm.status === "none" ? null : (
            <CrmIndicator crm={thread.crm} />
          )}
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
  return (
    <Table className="table-fixed">
      <TableHeader className="bg-muted/40">
        <TableRow className="hover:bg-transparent">
          <TableHead className={`${HEAD} w-[26%] pl-5`}>Lead</TableHead>
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
          <TableHead className={`${HEAD} w-20 text-center`}>HubSpot</TableHead>
          <TableHead className={`${HEAD} w-28 pr-5 text-right`}>
            {queue ? "Esperando" : "Actividad"}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <TableRow key={index} className="hover:bg-transparent">
                <TableCell className="py-3 pl-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-full" />
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
                <TableCell />
                <TableCell className="pr-5">
                  <Skeleton className="ml-auto h-3 w-12" />
                </TableCell>
              </TableRow>
            ))
          : threads.map((thread) => (
              <TableRow
                key={thread.id}
                className="cursor-pointer hover:bg-muted/40"
                onClick={() => router.push(`/threads/${thread.id}`)}
              >
                <TableCell className="py-3 pl-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(thread.name ?? thread.phone.slice(-2))}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Link
                          href={`/threads/${thread.id}`}
                          className="truncate text-sm font-medium outline-none hover:underline focus-visible:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {thread.name ?? "Sin nombre"}
                        </Link>
                        {thread.source === "form" ? (
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <span
                                  className="inline-flex text-muted-foreground"
                                  aria-label="Llegó por un formulario"
                                />
                              }
                            >
                              <FileTextIcon className="size-3.5" />
                            </TooltipTrigger>
                            <TooltipContent>
                              Llegó por un formulario
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
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
                <TableCell
                  className="text-center"
                  onClick={(event) => event.stopPropagation()}
                >
                  <CrmIndicator crm={thread.crm} />
                </TableCell>
                <TableCell className="pr-5 text-right text-xs text-muted-foreground tabular-nums">
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
