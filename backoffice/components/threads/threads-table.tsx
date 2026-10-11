"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileTextIcon, MessagesSquareIcon, SearchXIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPhone, formatRelative, initials } from "@/lib/format";
import type { Thread } from "@/lib/types";
import { CrmIndicator } from "./crm-indicator";
import { StatusBadge } from "./status-badge";

export function ThreadsTable({
  threads,
  loading,
  filtered,
}: {
  threads: Thread[];
  loading: boolean;
  filtered: boolean;
}) {
  const router = useRouter();

  if (!loading && threads.length === 0) {
    return (
      <Empty className="border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon">{filtered ? <SearchXIcon /> : <MessagesSquareIcon />}</EmptyMedia>
          <EmptyTitle>{filtered ? "No hay conversaciones con este filtro" : "Todavía no hay conversaciones"}</EmptyTitle>
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-4 lg:pl-6">Lead</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="hidden md:table-cell">Último mensaje</TableHead>
          <TableHead>Actividad</TableHead>
          <TableHead className="pr-4 text-center lg:pr-6">HubSpot</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 6 }, (_, index) => (
              <TableRow key={index}>
                <TableCell className="pl-4 lg:pl-6" colSpan={5}>
                  <Skeleton className="h-9 w-full" />
                </TableCell>
              </TableRow>
            ))
          : threads.map((thread) => (
              <TableRow
                key={thread.id}
                className="cursor-pointer"
                onClick={() => router.push(`/threads/${thread.id}`)}
              >
                <TableCell className="pl-4 lg:pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">{initials(thread.name ?? thread.phone.slice(-2))}</AvatarFallback>
                    </Avatar>
                    <div className="grid min-w-0 leading-tight">
                      <Link
                        href={`/threads/${thread.id}`}
                        className="truncate font-medium hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {thread.name ?? "Sin nombre"}
                      </Link>
                      <span className="truncate text-xs text-muted-foreground">{formatPhone(thread.phone)}</span>
                    </div>
                    {thread.source === "form" ? (
                      <Badge variant="outline" className="hidden gap-1 text-muted-foreground lg:inline-flex">
                        <FileTextIcon />
                        Formulario
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge thread={thread} />
                </TableCell>
                <TableCell className="hidden max-w-[22rem] md:table-cell">
                  <span className="block truncate text-muted-foreground">{thread.lastMessagePreview ?? "—"}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">{formatRelative(thread.lastMessageAt)}</TableCell>
                <TableCell className="pr-4 text-center lg:pr-6" onClick={(event) => event.stopPropagation()}>
                  <CrmIndicator crm={thread.crm} />
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
