"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SearchIcon } from "lucide-react";
import { SummaryCards } from "@/components/threads/summary-cards";
import { ThreadsTable } from "@/components/threads/threads-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useThreads, useThreadsSummary } from "@/lib/queries";
import { FILTERS, isStatusFilter } from "@/lib/thread-status";
import type { ThreadStatusFilter } from "@/lib/types";

function ThreadsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawStatus = params.get("status");
  const status: ThreadStatusFilter = isStatusFilter(rawStatus) ? rawStatus : "all";
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
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
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

  return (
    <>
      <SummaryCards summary={counts} active={status} onSelect={(next) => setParams({ status: next })} />
      <div className="px-4 lg:px-6">
        <Card className="gap-0 py-0 shadow-xs">
          <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <Tabs value={status} onValueChange={(value) => setParams({ status: value as ThreadStatusFilter })}>
              <div className="-mx-1 overflow-x-auto px-1">
                <TabsList>
                  {FILTERS.map((filter) => {
                    const count = filter.value === "all" ? counts?.total : counts?.[filter.value];
                    return (
                      <TabsTrigger key={filter.value} value={filter.value}>
                        {filter.label}
                        {count !== undefined ? <span className="text-xs text-muted-foreground tabular-nums">{count}</span> : null}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            </Tabs>
            <InputGroup className="lg:max-w-72">
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
            <div className="p-4 lg:p-6">
              <Alert variant="destructive">
                <AlertTitle>No se pudieron cargar las conversaciones</AlertTitle>
                <AlertDescription>{threads.error.message}</AlertDescription>
              </Alert>
            </div>
          ) : (
            <ThreadsTable threads={rows} loading={threads.isPending} filtered={status !== "all" || Boolean(search)} />
          )}
          {threads.hasNextPage ? (
            <div className="flex justify-center border-t p-3">
              <Button variant="ghost" onClick={() => threads.fetchNextPage()} disabled={threads.isFetchingNextPage}>
                {threads.isFetchingNextPage ? <Spinner /> : null}
                Ver más conversaciones
              </Button>
            </div>
          ) : null}
        </Card>
      </div>
    </>
  );
}

export default function ThreadsPage() {
  return (
    <Suspense fallback={null}>
      <ThreadsView />
    </Suspense>
  );
}
