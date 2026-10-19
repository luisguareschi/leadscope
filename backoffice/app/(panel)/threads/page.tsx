"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { HandIcon, SearchIcon } from "lucide-react";
import { cn } from "cn";
import { Notice, Panel } from "@/components/panel";
import { ThreadsTable } from "@/components/threads/threads-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useThreads, useThreadsSummary } from "@/lib/queries";
import { FILTERS, isStatusFilter } from "@/lib/thread-status";
import type { ThreadStatusFilter } from "@/lib/types";

function ThreadsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawStatus = params.get("status");
  const status: ThreadStatusFilter = isStatusFilter(rawStatus)
    ? rawStatus
    : "all";
  const search = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  const summary = useThreadsSummary();
  const threads = useThreads(status, search);

  const setParams = (next: { status?: ThreadStatusFilter; q?: string }) => {
    const updated = new URLSearchParams(params);
    const nextStatus = next.status ?? status;
    const nextSearch = next.q ?? search;
    if (nextStatus === "all") updated.delete("status");
    else updated.set("status", nextStatus);
    if (nextSearch) updated.set("q", nextSearch);
    else updated.delete("q");
    const query = updated.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== search) setParams({ q: searchInput.trim() });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const rows = threads.data?.pages.flatMap((page) => page.threads) ?? [];
  const counts = summary.data;
  const waiting = counts?.needs_human ?? 0;

  return (
    <div className="@container/content flex flex-col gap-4 px-4 lg:px-6">
      {waiting > 0 && status !== "needs_human" ? (
        <Notice
          tone="warning"
          icon={<HandIcon />}
          title={
            waiting === 1
              ? "1 conversación espera a un asesor"
              : `${waiting} conversaciones esperan a un asesor`
          }
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setParams({ status: "needs_human" })}
            >
              Ver
            </Button>
          }
        >
          El asistente se detuvo y no responde hasta que alguien la marque como
          atendida.
        </Notice>
      ) : null}

      <div className="flex flex-col gap-3 @3xl/content:flex-row @3xl/content:items-center @3xl/content:justify-between">
        <div
          role="group"
          aria-label="Filtrar por estado"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-6 lg:px-6 @3xl/content:mx-0 @3xl/content:px-0"
        >
          {FILTERS.map((filter) => {
            const count =
              filter.value === "all" ? counts?.total : counts?.[filter.value];
            const selected = status === filter.value;
            const attention =
              filter.value === "needs_human" && (count ?? 0) > 0;
            return (
              <Button
                key={filter.value}
                aria-pressed={selected}
                size="sm"
                variant={selected ? "secondary" : "ghost"}
                className={cn(
                  "shrink-0",
                  selected ? "text-foreground" : "text-muted-foreground",
                )}
                onClick={() => setParams({ status: filter.value })}
              >
                {filter.label}
                {count !== undefined ? (
                  <span
                    className={cn(
                      "rounded px-1 text-xs tabular-nums",
                      attention
                        ? "bg-amber-500/15 font-medium text-amber-800 dark:text-amber-300"
                        : "text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Button>
            );
          })}
        </div>
        <InputGroup className="@3xl/content:max-w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Buscar por nombre o teléfono"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            aria-label="Buscar conversaciones"
          />
        </InputGroup>
      </div>

      {threads.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudieron cargar las conversaciones</AlertTitle>
          <AlertDescription>{threads.error.message}</AlertDescription>
        </Alert>
      ) : (
        <Panel>
          <ThreadsTable
            threads={rows}
            loading={threads.isPending}
            filtered={status !== "all" || Boolean(search)}
          />
          {threads.hasNextPage ? (
            <div className="flex justify-center p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => threads.fetchNextPage()}
                disabled={threads.isFetchingNextPage}
              >
                {threads.isFetchingNextPage ? <Spinner /> : null}
                Ver más conversaciones
              </Button>
            </div>
          ) : null}
        </Panel>
      )}
    </div>
  );
}

export default function ThreadsPage() {
  return (
    <Suspense fallback={null}>
      <ThreadsView />
    </Suspense>
  );
}
