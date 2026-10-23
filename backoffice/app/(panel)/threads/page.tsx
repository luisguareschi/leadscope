"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import {
  BotIcon,
  ChevronDownIcon,
  HandIcon,
  SearchIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { cn } from "cn";
import { Notice, Panel } from "@/components/panel";
import { ThreadsTable } from "@/components/threads/threads-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useMe, useThreads, useThreadsSummary } from "@/lib/queries";
import {
  BOT_FILTERS,
  isBotFilter,
  isStageFilter,
  STAGE_FILTERS,
} from "@/lib/thread-status";
import type { BotFilter, StageFilter, ThreadsSummary } from "@/lib/types";

function countFor(
  counts: ThreadsSummary | undefined,
  stage: StageFilter,
): number | undefined {
  if (!counts) return undefined;
  return stage === "all" ? counts.total : counts.stages[stage];
}

function ThreadsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const me = useMe();
  const rawStage = params.get("stage");
  const rawBot = params.get("bot");
  const stage: StageFilter = isStageFilter(rawStage) ? rawStage : "all";
  const bot: BotFilter = isBotFilter(rawBot) ? rawBot : "all";
  // A platform admin in support access has no operator row here, so nothing is "theirs".
  const canBeAssigned = me.data ? !me.data.supportAccess : false;
  const mine = canBeAssigned && params.get("mine") === "1";
  const search = params.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(search);

  const summary = useThreadsSummary();
  const threads = useThreads({
    stage,
    bot,
    assignee: mine ? "me" : "all",
    search,
  });

  const setParams = (next: {
    stage?: StageFilter;
    bot?: BotFilter;
    mine?: boolean;
    q?: string;
  }) => {
    const updated = new URLSearchParams(params);
    const values = {
      stage: next.stage ?? stage,
      bot: next.bot ?? bot,
      mine: next.mine ?? mine,
      q: next.q ?? search,
    };
    for (const key of ["stage", "bot"] as const) {
      if (values[key] === "all") updated.delete(key);
      else updated.set(key, values[key]);
    }
    if (values.mine) updated.set("mine", "1");
    else updated.delete("mine");
    if (values.q) updated.set("q", values.q);
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
  const waiting = counts?.bot.needs_human ?? 0;
  const botLabel =
    BOT_FILTERS.find((filter) => filter.value === bot)?.label ?? "";

  return (
    <div className="@container/content flex flex-col gap-4 px-4 lg:px-6">
      {waiting > 0 && bot !== "needs_human" ? (
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
              onClick={() => setParams({ bot: "needs_human", stage: "all" })}
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
          aria-label="Filtrar por etapa"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:-mx-6 lg:px-6 @3xl/content:mx-0 @3xl/content:px-0"
        >
          {STAGE_FILTERS.map((filter) => {
            const count = countFor(counts, filter.value);
            const selected = stage === filter.value;
            const attention = filter.value === "to_contact" && (count ?? 0) > 0;
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
                onClick={() => setParams({ stage: filter.value })}
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

      <div className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-2 lg:gap-x-3">
        {canBeAssigned ? (
          <Button
            size="sm"
            variant={mine ? "secondary" : "outline"}
            aria-pressed={mine}
            className={cn(mine && "text-foreground")}
            onClick={() => setParams({ mine: !mine })}
          >
            <UserRoundCheckIcon />
            Asignadas a mí
            {counts?.mine ? (
              <span className="rounded px-1 text-xs text-muted-foreground tabular-nums">
                {stage === "to_contact"
                  ? counts.mine.toContact
                  : counts.mine.all}
              </span>
            ) : null}
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                variant={bot === "all" ? "outline" : "secondary"}
                aria-label="Filtrar por asistente"
              />
            }
          >
            <BotIcon />
            {botLabel}
            <ChevronDownIcon className="text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuRadioGroup
              value={bot}
              onValueChange={(value) => {
                if (isBotFilter(value)) setParams({ bot: value });
              }}
            >
              {BOT_FILTERS.map((filter) => (
                <DropdownMenuRadioItem key={filter.value} value={filter.value}>
                  {filter.value === "all" ? "Todos" : filter.label}
                  {filter.value !== "all" && counts ? (
                    <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                      {counts.bot[filter.value]}
                    </span>
                  ) : null}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        {stage === "to_contact" ? (
          <p className="text-[13px] text-muted-foreground">
            Primero los que más esperan. Siguen acá aunque vuelvan a escribir,
            hasta que alguien los marque como contactados.
          </p>
        ) : null}
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
            filtered={
              stage !== "all" || bot !== "all" || mine || Boolean(search)
            }
            queue={stage === "to_contact"}
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
