"use client";

import { Panel, StatusDot } from "@/components/panel";
import { formatCount, formatPercent } from "@/lib/metrics-format";
import { STAGE_CHART_COLOR, STAGE_META } from "@/lib/thread-status";
import type { CompanyMetrics } from "@/lib/types";

export function ConversionFunnel({
  funnel,
  forms,
}: {
  funnel: CompanyMetrics["funnel"];
  forms: CompanyMetrics["forms"];
}) {
  const steps = [
    {
      label: "Leads nuevos",
      count: funnel.leads,
      percentLabel: "100%",
      widthPct: funnel.leads > 0 ? 100 : 0,
      color: STAGE_CHART_COLOR.qualifying,
    },
    {
      label: "Calificados",
      count: funnel.qualified,
      percentLabel: formatPercent(funnel.qualificationRate),
      widthPct:
        funnel.leads > 0
          ? Math.round((funnel.qualified / funnel.leads) * 100)
          : 0,
      color: STAGE_CHART_COLOR.to_contact,
    },
    {
      label: "Contactados",
      count: funnel.contacted,
      percentLabel:
        funnel.contactedRate != null
          ? `${formatPercent(funnel.contactedRate)} de calificados`
          : "—",
      widthPct:
        funnel.leads > 0
          ? Math.round((funnel.contacted / funnel.leads) * 100)
          : 0,
      color: STAGE_CHART_COLOR.contacted,
    },
  ];

  return (
    <Panel
      title="Embudo de conversión"
      description="Estado actual de los leads que llegaron en este período."
      className="flex h-full flex-col"
    >
      {funnel.leads === 0 ? (
        <p className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Sin leads en este período.
        </p>
      ) : (
        <div className="flex flex-1 flex-col justify-between divide-y divide-border/70">
          <div className="flex flex-col gap-4 px-5 py-4">
            {steps.map((step) => (
              <div key={step.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{step.label}</span>
                  <span className="tabular-nums">
                    <span className="font-semibold">
                      {formatCount(step.count)}
                    </span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {step.percentLabel}
                    </span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${step.widthPct}%`,
                      backgroundColor: step.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3.5 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <StatusDot tone={STAGE_META.qualifying.tone} />
              En calificación: {formatCount(funnel.qualifying)}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <StatusDot tone={STAGE_META.to_contact.tone} />
              Por contactar: {formatCount(funnel.toContact)}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <StatusDot tone={STAGE_META.not_interested.tone} />
              Sin interés: {formatCount(funnel.notInterested)} (
              {formatPercent(funnel.notInterestedRate)})
            </span>
          </div>

          {forms.leads > 0 ? (
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3.5 text-sm">
              <span className="font-medium">Respuesta a formularios</span>
              <span className="tabular-nums">
                <span className="font-semibold">
                  {formatPercent(forms.replyRate)}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {formatCount(forms.replied)} de {formatCount(forms.leads)}{" "}
                  respondieron tras la bienvenida
                </span>
              </span>
            </div>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
