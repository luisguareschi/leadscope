"use client";

import { cn } from "cn";
import { Panel } from "@/components/panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount, formatDuration } from "@/lib/metrics-format";
import { operatorName } from "@/lib/thread-status";
import type { AdvisorMetrics } from "@/lib/types";

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
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("text-sm tabular-nums", className)}>{value}</dd>
    </div>
  );
}

export function AdvisorsTable({ advisors }: { advisors: AdvisorMetrics[] }) {
  if (advisors.length < 2) return null;

  return (
    <Panel
      title="Rendimiento por asesor"
      description="Contactos realizados en el período y carga actual en cola."
    >
      <div>
        <div className="max-md:hidden">
          <Table className="min-w-[36rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Asesor</TableHead>
                <TableHead className="text-right">Contactados</TableHead>
                <TableHead className="text-right">
                  Mediana hasta contactar
                </TableHead>
                <TableHead className="text-right">En cola ahora</TableHead>
                <TableHead className="text-right">Con más de 24 h</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advisors.map((advisor) => (
                <TableRow key={advisor.operatorId}>
                  <TableCell>
                    <span className="block font-medium">
                      {operatorName(advisor.email)}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {advisor.email}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(advisor.contactedInRange)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDuration(advisor.medianMinutesToContact)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCount(advisor.assigned)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right tabular-nums",
                      advisor.pendingOver24h > 0 && "font-medium text-primary",
                    )}
                  >
                    {formatCount(advisor.pendingOver24h)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <ul className="divide-y divide-border/70 md:hidden">
          {advisors.map((advisor) => (
            <li
              key={advisor.operatorId}
              className="flex flex-col gap-3 px-5 py-3.5"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {operatorName(advisor.email)}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {advisor.email}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <Stat
                  label="Contactados"
                  value={formatCount(advisor.contactedInRange)}
                />
                <Stat
                  label="Mediana"
                  value={formatDuration(advisor.medianMinutesToContact)}
                />
                <Stat label="En cola" value={formatCount(advisor.assigned)} />
                <Stat
                  label="Más de 24 h"
                  value={formatCount(advisor.pendingOver24h)}
                  className={cn(
                    advisor.pendingOver24h > 0 && "font-medium text-primary",
                  )}
                />
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
