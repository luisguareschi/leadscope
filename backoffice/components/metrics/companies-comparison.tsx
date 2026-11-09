"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { cn } from "cn";
import { Building2Icon } from "lucide-react";
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
            Los días de esta tabla se cuentan en un mismo huso horario para
            todas las empresas.
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
                    ? "Cuando exista una empresa, sus números aparecen aquí."
                    : "Muestra las archivadas para ver alguna, o crea una empresa."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : query.data ? (
            <Table className="min-w-[64rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Leads nuevos</TableHead>
                  <TableHead className="text-right">Calificados</TableHead>
                  <TableHead className="text-right">Sin interés</TableHead>
                  <TableHead className="text-right">Fuera de horario</TableHead>
                  <TableHead className="text-right">
                    Tiempo hasta contactar
                  </TableHead>
                  <TableHead className="text-right">Sin asesor</TableHead>
                  <TableHead className="text-right">
                    Asistente detenido
                  </TableHead>
                  <TableHead className="text-right">Última subida</TableHead>
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
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onSelect(row.company.id);
                            }
                          }
                        : undefined
                    }
                  >
                    <TableCell>
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            "truncate font-medium",
                            row.company.archived && "text-muted-foreground",
                          )}
                        >
                          {row.company.name}
                        </span>
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
                      {formatPercent(row.notInterestedRate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(row.outOfHoursRate)}
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
                    <TableCell className="text-right">
                      {formatDaysAgo(row.daysSinceLastUpload)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(row.spendUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </Panel>
      )}
    </section>
  );
}
