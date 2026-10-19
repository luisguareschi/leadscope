"use client";

import Link from "next/link";
import { FileTextIcon, MessagesSquareIcon, SearchXIcon } from "lucide-react";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatPhone, formatRelative, initials } from "@/lib/format";
import type { Thread } from "@/lib/types";
import { CrmIndicator } from "./crm-indicator";
import { StatusBadge } from "./status-badge";

const ROW =
  "grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-3 @3xl/content:grid-cols-[2rem_minmax(0,14rem)_9.5rem_minmax(0,1fr)_auto] @3xl/content:gap-x-5";

export function ThreadsTable({
  threads,
  loading,
  filtered,
}: {
  threads: Thread[];
  loading: boolean;
  filtered: boolean;
}) {
  if (loading) {
    return (
      <ul className="divide-y">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className={ROW}>
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="hidden h-5 w-24 rounded-full @3xl/content:block" />
            <Skeleton className="hidden h-3.5 w-full max-w-md @3xl/content:block" />
            <Skeleton className="h-3 w-12" />
          </li>
        ))}
      </ul>
    );
  }

  if (threads.length === 0) {
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
              ? "Probá con otro estado o buscá por otro nombre o teléfono."
              : "Cuando un lead escriba al número de WhatsApp, la conversación aparece acá."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul className="divide-y">
      {threads.map((thread) => (
        <li key={thread.id} className="relative">
          <div className={`${ROW} transition-colors hover:bg-muted/40`}>
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {initials(thread.name ?? thread.phone.slice(-2))}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <Link
                  href={`/threads/${thread.id}`}
                  className="truncate text-sm font-medium outline-none after:absolute after:inset-0 focus-visible:underline"
                >
                  {thread.name ?? "Sin nombre"}
                </Link>
                {thread.source === "form" ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span
                          className="relative inline-flex text-muted-foreground"
                          aria-label="Llegó por un formulario"
                        />
                      }
                    >
                      <FileTextIcon className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>Llegó por un formulario</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-xs text-muted-foreground tabular-nums">
                  {formatPhone(thread.phone)}
                </span>
                <StatusBadge thread={thread} className="@3xl/content:hidden" />
              </div>
            </div>
            <StatusBadge
              thread={thread}
              className="hidden @3xl/content:inline-flex"
            />
            <p className="hidden truncate text-sm text-muted-foreground @3xl/content:block">
              {thread.lastMessagePreview ?? "—"}
            </p>
            <div className="flex items-center justify-end gap-3">
              <span className="relative">
                <CrmIndicator crm={thread.crm} />
              </span>
              <span className="w-14 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                {formatRelative(thread.lastMessageAt)}
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
