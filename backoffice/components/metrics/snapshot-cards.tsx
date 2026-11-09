"use client";

import Link from "next/link";
import { cn } from "cn";
import { Panel } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  formatCount,
  formatDaysAgo,
  formatDuration,
} from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";

const REASON_LABELS: Record<string, string> = {
  forbidden_topic: "Tema prohibido",
  model_failure: "Falla del modelo",
  send_failed: "Falla de WhatsApp",
  lead_needs_human: "Pidió una persona",
  empty_reply: "Respuesta vacía",
  channel_unavailable: "WhatsApp no disponible",
  other: "Otro",
};

const REASON_ORDER = Object.keys(REASON_LABELS);

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning" | "error";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "font-heading text-xl font-semibold tracking-tight tabular-nums",
          tone === "warning" && "text-primary",
          tone === "error" && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function reasonRows(byReason: Record<string, number>): Array<{
  key: string;
  label: string;
  count: number;
}> {
  const known = REASON_ORDER.filter((key) => (byReason[key] ?? 0) > 0).map(
    (key) => ({
      key,
      label: REASON_LABELS[key],
      count: byReason[key],
    }),
  );
  const extra = Object.entries(byReason)
    .filter(([key, count]) => count > 0 && !REASON_LABELS[key])
    .map(([key, count]) => ({ key, label: key, count }));
  return [...known, ...extra];
}

export function SnapshotCards({
  queue,
  needsHuman,
  knowledge,
  hubspot,
}: {
  queue: CompanyMetrics["queue"];
  needsHuman: CompanyMetrics["needsHuman"];
  knowledge: CompanyMetrics["knowledge"];
  hubspot: CompanyMetrics["hubspot"];
}) {
  const reasons = reasonRows(needsHuman.byReason);
  const knowledgeStale =
    knowledge.daysSinceLastUpload != null && knowledge.daysSinceLastUpload > 30;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Panel
        title="Cola Por contactar"
        actions={
          <Button
            variant="link"
            size="sm"
            className="px-0"
            render={<Link href="/threads?stage=to_contact" />}
          >
            Ver cola
          </Button>
        }
      >
        <dl className="grid grid-cols-2 gap-4 px-5 py-4">
          <Stat label="En cola" value={formatCount(queue.toContact)} />
          <Stat label="Sin asesor" value={formatCount(queue.unassigned)} />
          <Stat
            label="Con más de 24 h"
            value={formatCount(queue.unassignedOver24h)}
            tone={queue.unassignedOver24h > 0 ? "warning" : undefined}
          />
          <Stat
            label="Espera más larga"
            value={formatDuration(queue.oldestWaitingMinutes)}
          />
        </dl>
      </Panel>

      <Panel title="Asistente detenido">
        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="font-heading text-xl font-semibold tracking-tight tabular-nums">
            {formatCount(needsHuman.total)}
          </p>
          {reasons.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              Ninguna conversación está detenida.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {reasons.map((reason) => (
                <li
                  key={reason.key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground">{reason.label}</span>
                  <span className="tabular-nums">
                    {formatCount(reason.count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel
        title="Conocimiento"
        actions={
          <Button
            variant="link"
            size="sm"
            className="px-0"
            render={<Link href="/knowledge" />}
          >
            Ver conocimiento
          </Button>
        }
      >
        <div className="flex flex-col gap-1.5 px-5 py-4">
          {knowledge.files === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay archivos.
            </p>
          ) : (
            <>
              <p
                className={cn(
                  "text-sm",
                  knowledgeStale && "font-medium text-primary",
                )}
              >
                Última subida {formatDaysAgo(knowledge.daysSinceLastUpload)}.
              </p>
              {knowledgeStale ? (
                <p className="text-[13px] font-medium text-primary">
                  Revisa que los precios estén al día.
                </p>
              ) : null}
              <p className="text-[13px] text-muted-foreground">
                {knowledge.files === 1
                  ? "1 archivo"
                  : `${formatCount(knowledge.files)} archivos`}
              </p>
            </>
          )}
        </div>
      </Panel>

      {hubspot.enabled ? (
        <Panel title="HubSpot">
          <dl className="grid grid-cols-2 gap-4 px-5 py-4">
            <Stat
              label="Escrituras pendientes"
              value={formatCount(hubspot.pending)}
            />
            <Stat
              label="Con error"
              value={formatCount(hubspot.failing)}
              tone={hubspot.failing > 0 ? "error" : undefined}
            />
          </dl>
        </Panel>
      ) : null}
    </div>
  );
}
