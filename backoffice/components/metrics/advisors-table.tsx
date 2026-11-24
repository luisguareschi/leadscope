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

export function AdvisorsTable({ advisors }: { advisors: AdvisorMetrics[] }) {
  if (advisors.length < 2) return null;

  return (
    <Panel
      title="Rendimiento por asesor"
      description="Contactos realizados en el período y carga actual en cola."
    >
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
    </Panel>
  );
}
