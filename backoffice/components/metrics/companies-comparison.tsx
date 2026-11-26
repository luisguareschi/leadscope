"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "cn";
import { Building2Icon, ChevronRightIcon } from "lucide-react";
import { Panel, StatusPill } from "@/components/panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCount,
  formatDaysAgo,
  formatDuration,
  formatPercent,
  formatUsd,
} from "@/lib/metrics-format";
import type { CompaniesMetrics } from "@/lib/types";

type CompanyRow = CompaniesMetrics["rows"][number];

/** Spans only, so it can sit inside the row's button. */
function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm break-words tabular-nums", className)}>
        {value}
      </span>
    </span>
  );
}

/** Below `md`, each company is a card instead of a 10-column table row. */
function CompanyCard({
  row,
  clickable,
  onSelect,
}: {
  row: CompanyRow;
  clickable: boolean;
  onSelect: (companyId: string) => void;
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            {clickable ? (
              <span className="sr-only">Ver el detalle de</span>
            ) : null}
            <span
              className={cn(
                "truncate text-sm font-medium",
                row.company.archived && "text-muted-foreground",
              )}
            >
              {row.company.name}
            </span>
            {row.company.assistantPaused ? (
              <StatusPill tone="error">Pausado</StatusPill>
            ) : null}
            {row.company.archived ? (
              <StatusPill tone="muted">Archivada</StatusPill>
            ) : null}
          </span>
          <span className="truncate font-mono text-xs text-muted-foreground">
            {row.company.slug}
          </span>
        </span>
        {clickable ? (
          <ChevronRightIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
        ) : null}
      </span>
      <span className="grid grid-cols-3 gap-x-4 gap-y-2.5">
        <Stat label="Leads" value={formatCount(row.leads)} />
        <Stat label="Calif." value={formatPercent(row.qualificationRate)} />
        <Stat label="Contact." value={formatPercent(row.contactedRate)} />
        <Stat
          label="Mediana"
          value={formatDuration(row.medianMinutesToContact)}
        />
        <Stat
          label="Sin asesor"
          value={formatCount(row.unassignedToContact)}
          className={cn(
            row.unassignedToContact > 0 && "font-medium text-primary",
          )}
        />
        <Stat
          label="Detenido"
          value={formatCount(row.needsHuman)}
          className={cn(row.needsHuman > 0 && "font-medium text-primary")}
        />
        <Stat
          label="Errores"
          value={formatCount(row.issuesCount)}
          className={cn(row.issuesCount > 0 && "font-medium text-destructive")}
        />
        <Stat
          label="Últ. subida"
          value={formatDaysAgo(row.daysSinceLastUpload)}
        />
        <Stat label="Gasto" value={formatUsd(row.spendUsd)} />
      </span>
    </>
  );

  return (
    <li>
      {clickable ? (
        <button
          type="button"
          onClick={() => onSelect(row.company.id)}
          className="flex w-full flex-col gap-3 px-5 py-3.5 text-left transition-colors outline-none hover:bg-accent focus-visible:bg-accent active:bg-accent"
        >
          {body}
        </button>
      ) : (
        <div className="flex flex-col gap-3 px-5 py-3.5">{body}</div>
      )}
    </li>
  );
}

export function CompaniesComparison({
  query,
  showArchived,
  onShowArchivedChange,
  clickable,
  onSelect,
}: {
  query: UseQueryResult<CompaniesMetrics, Error>;
  showArchived: boolean;
  onShowArchivedChange: (value: boolean) => void;
  /** Outside a company, a row picks that company. Inside support access it does not. */
  clickable: boolean;
  onSelect: (companyId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Comparación entre empresas
          </h2>
          <p className="text-sm text-muted-foreground">
            Todas las empresas se comparan bajo la misma zona horaria.
          </p>
        </div>
        <div className="flex items-center gap-2 px-2">
          <Switch
            id="metrics-show-archived"
            checked={showArchived}
            onCheckedChange={onShowArchivedChange}
          />
          <Label
            htmlFor="metrics-show-archived"
            className="font-normal whitespace-nowrap text-muted-foreground"
          >
            Mostrar archivadas
          </Label>
        </div>
      </header>

      {query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>No se pudo cargar la comparación</AlertTitle>
          <AlertDescription>{query.error?.message}</AlertDescription>
        </Alert>
      ) : (
        <Panel>
          {query.isPending ? (
            <div className="flex flex-col gap-2 p-5">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : query.data && query.data.rows.length === 0 ? (
            <Empty className="border-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Building2Icon />
                </EmptyMedia>
                <EmptyTitle>
                  {showArchived ? "No hay empresas" : "No hay empresas activas"}
                </EmptyTitle>
                <EmptyDescription>
                  {showArchived
                    ? "Las métricas aparecerán aquí cuando exista al menos una empresa."
                    : "Muestra las archivadas o crea una nueva empresa."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : query.data ? (
            <div>
              <ul className="divide-y divide-border/70 md:hidden">
                {query.data.rows.map((row) => (
                  <CompanyCard
                    key={row.company.id}
                    row={row}
                    clickable={clickable}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
              <div className="max-md:hidden">
                <Table className="min-w-[66rem]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead className="text-right">Leads nuevos</TableHead>
                      <TableHead className="text-right">Calificados</TableHead>
                      <TableHead className="text-right">Contactados</TableHead>
                      <TableHead className="text-right">
                        Tiempo hasta contactar
                      </TableHead>
                      <TableHead className="text-right">Sin asesor</TableHead>
                      <TableHead className="text-right">Detenido</TableHead>
                      <TableHead className="text-right">Errores</TableHead>
                      <TableHead className="text-right">
                        Última subida
                      </TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.rows.map((row) => (
                      <TableRow
                        key={row.company.id}
                        className={cn(clickable && "cursor-pointer")}
                        tabIndex={clickable ? 0 : undefined}
                        aria-label={
                          clickable
                            ? `Ver el detalle de ${row.company.name}`
                            : undefined
                        }
                        onClick={
                          clickable ? () => onSelect(row.company.id) : undefined
                        }
                        onKeyDown={
                          clickable
                            ? (event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  onSelect(row.company.id);
                                }
                              }
                            : undefined
                        }
                      >
                        <TableCell>
                          <span className="flex min-w-0 flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "truncate font-medium",
                                row.company.archived && "text-muted-foreground",
                              )}
                            >
                              {row.company.name}
                            </span>
                            {row.company.assistantPaused ? (
                              <StatusPill tone="error">Pausado</StatusPill>
                            ) : null}
                            {row.company.archived ? (
                              <StatusPill tone="muted">Archivada</StatusPill>
                            ) : null}
                          </span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {row.company.slug}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.leads)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(row.qualificationRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatPercent(row.contactedRate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatDuration(row.medianMinutesToContact)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.unassignedToContact)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCount(row.needsHuman)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            row.issuesCount > 0 &&
                              "font-medium text-destructive",
                          )}
                        >
                          {formatCount(row.issuesCount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDaysAgo(row.daysSinceLastUpload)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className="block">
                            {formatUsd(row.spendUsd)}
                          </span>
                          {row.anthropicUsd !== null && row.anthropicUsd > 0 ? (
                            <span className="block text-xs text-muted-foreground">
                              Anthropic: {formatUsd(row.anthropicUsd)}
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </Panel>
      )}
    </section>
  );
}
