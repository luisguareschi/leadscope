"use client";

import { Panel } from "@/components/panel";
import { formatCount, formatPercent, leadsLabel } from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";

export function AssistantHealthCard({
  leads,
  assistant,
}: {
  leads: number;
  assistant: CompanyMetrics["assistant"];
}) {
  return (
    <Panel
      title="Desempeño del asistente"
      description="Cómo gestiona el asistente las conversaciones del período."
    >
      <dl className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-muted-foreground">
            Resolución autónoma
          </dt>
          <dd className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatPercent(assistant.autonomyRate)}
          </dd>
          <p className="text-xs text-muted-foreground">
            {leads > 0
              ? `${formatCount(assistant.autonomousLeads)} de ${formatCount(leads)} leads sin intervención humana`
              : "Sin leads en este período"}
          </p>
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-[13px] text-muted-foreground">
            Audios e imágenes
          </dt>
          <dd className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {formatPercent(assistant.nonTextRate)}
          </dd>
          <p className="text-xs text-muted-foreground">
            {assistant.nonTextLeads > 0
              ? `${leadsLabel(assistant.nonTextLeads)} enviaron multimedia (${formatCount(assistant.nonTextMessages)} ${assistant.nonTextMessages === 1 ? "mensaje" : "mensajes"})`
              : "Ningún lead envió audio ni imágenes"}
          </p>
        </div>
      </dl>

      {assistant.fieldCompletion.length > 0 ? (
        <div className="flex flex-col gap-3 px-5 py-4">
          <h4 className="text-sm font-semibold">
            Datos recolectados por campo
          </h4>
          {leads === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Sin leads en este período.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {assistant.fieldCompletion.map((field) => {
                const widthPct =
                  field.rate != null ? Math.round(field.rate * 100) : 0;
                return (
                  <div key={field.key} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="truncate font-medium">
                        {field.name}
                        {!field.required ? (
                          <span className="ml-1.5 font-normal text-muted-foreground">
                            (opcional)
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        <span className="font-medium">
                          {formatPercent(field.rate)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {formatCount(field.collected)}/{formatCount(leads)}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
