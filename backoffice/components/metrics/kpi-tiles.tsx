"use client";

import { cn } from "cn";
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
      hero: true,
    },
    {
      label: "Calificados",
      value: formatPercent(funnel.qualificationRate),
      caption:
        metrics.leads > 0
          ? `${formatCount(funnel.qualified)} de ${formatCount(metrics.leads)} leads`
          : "Sin leads en este período",
      hero: false,
    },
    {
      label: "Contactados",
      value: formatPercent(funnel.contactedRate),
      caption:
        funnel.qualified > 0
          ? `${formatCount(funnel.contacted)} de ${formatCount(funnel.qualified)} calificados`
          : "Sin calificados aún",
      hero: false,
    },
    {
      label: "Tiempo hasta contactar",
      value: formatDuration(timeToContact.medianMinutes),
      caption:
        timeToContact.p90Minutes != null
          ? `90% en menos de ${formatDuration(timeToContact.p90Minutes)}`
          : "Sin leads contactados",
      hero: false,
    },
    {
      label: "Fuera de horario",
      value: formatPercent(metrics.outOfHoursRate),
      caption: `${leadsLabel(metrics.outOfHours)} fuera de 9 a 18 h o fin de semana`,
      hero: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className={cn(
            "revolut-card relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-[22px] px-4.5 py-4 first:col-span-2 md:first:col-span-1",
            tile.hero &&
              "bg-gradient-to-br from-primary/[0.08] via-card to-card dark:from-primary/20 dark:via-card dark:to-card",
          )}
        >
          <p className="text-[13px] leading-snug font-medium text-muted-foreground">
            {tile.label}
          </p>
          <p
            className={cn(
              "font-heading font-bold tracking-[-0.03em] tabular-nums",
              tile.hero
                ? "text-[32px] leading-none md:text-[28px]"
                : "text-[26px] leading-tight",
            )}
          >
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
