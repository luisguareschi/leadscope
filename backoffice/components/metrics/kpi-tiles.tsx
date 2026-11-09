"use client";

import {
  formatCount,
  formatDuration,
  formatPercent,
  leadsLabel,
} from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";

export function KpiTiles({ metrics }: { metrics: CompanyMetrics }) {
  const tiles = [
    {
      label: "Leads nuevos",
      value: formatCount(metrics.leads),
      caption: `${formatCount(metrics.leadsBySource.whatsapp)} por WhatsApp · ${formatCount(metrics.leadsBySource.form)} por formulario`,
    },
    {
      label: "Calificados",
      value: formatPercent(metrics.qualificationRate),
      caption: leadsLabel(metrics.qualified),
    },
    {
      label: "Sin interés",
      value: formatPercent(metrics.notInterestedRate),
      caption: leadsLabel(metrics.notInterested),
    },
    {
      label: "Fuera de horario",
      value: formatPercent(metrics.outOfHoursRate),
      caption: "Escribieron fuera de 9 a 18 h o en fin de semana",
    },
    {
      label: "Tiempo hasta contactar",
      value: formatDuration(metrics.timeToContact.medianMinutes),
      caption: `p90: ${formatDuration(metrics.timeToContact.p90Minutes)}`,
    },
    {
      label: "Pidieron hablar ya",
      value: formatCount(metrics.callNow),
      caption: "Lo antes posible",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex min-w-0 flex-col gap-1 rounded-xl bg-card px-4 py-4 ring-1 ring-border/60 dark:ring-0"
        >
          <p className="text-[13px] leading-snug text-muted-foreground">
            {tile.label}
          </p>
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {tile.value}
          </p>
          <p className="text-xs leading-snug text-pretty text-muted-foreground">
            {tile.caption}
          </p>
        </div>
      ))}
    </div>
  );
}
