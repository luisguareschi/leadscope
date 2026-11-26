"use client";

import {
  formatCount,
  formatDuration,
  formatPercent,
  leadsLabel,
} from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";

export function KpiTiles({ metrics }: { metrics: CompanyMetrics }) {
  const { funnel, timeToContact } = metrics;
  const tiles = [
    {
      label: "Leads nuevos",
      value: formatCount(metrics.leads),
      caption: `${formatCount(metrics.leadsBySource.whatsapp)} por WhatsApp · ${formatCount(metrics.leadsBySource.form)} por formulario`,
    },
    {
      label: "Calificados",
      value: formatPercent(funnel.qualificationRate),
      caption:
        metrics.leads > 0
          ? `${formatCount(funnel.qualified)} de ${formatCount(metrics.leads)} leads`
          : "Sin leads en este período",
    },
    {
      label: "Contactados",
      value: formatPercent(funnel.contactedRate),
      caption:
        funnel.qualified > 0
          ? `${formatCount(funnel.contacted)} de ${formatCount(funnel.qualified)} calificados`
          : "Sin calificados aún",
    },
    {
      label: "Tiempo hasta contactar",
      value: formatDuration(timeToContact.medianMinutes),
      caption:
        timeToContact.p90Minutes != null
          ? `90% en menos de ${formatDuration(timeToContact.p90Minutes)}`
          : "Sin leads contactados",
    },
    {
      label: "Fuera de horario",
      value: formatPercent(metrics.outOfHoursRate),
      caption: `${leadsLabel(metrics.outOfHours)} fuera de 9 a 18 h o fin de semana`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="flex min-w-0 flex-col gap-1 rounded-xl bg-card px-4 py-4 ring-1 ring-border/60 first:col-span-2 md:first:col-span-1 dark:ring-0"
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
