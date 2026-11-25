"use client";

import { cn } from "cn";
import { Panel, StatusDot } from "@/components/panel";
import { Detail, Group } from "@/components/threads/lead-details";
import { formatNumber } from "@/lib/format";
import { stageMetaOf } from "@/lib/thread-status";
import type { CompanyConfig, TestLead, TestTurnResponse } from "@/lib/types";

/** The engine's conversation step, in plain words. */
const STATE_LABELS: Record<TestLead["state"], string> = {
  greeting: "Saludo",
  qualify: "Recopilando datos",
  handoff: "Solicitando horario",
  answer: "Respondiendo preguntas",
  closed: "Cerrada",
};

const INTENT_LABELS: Record<string, string> = {
  continue: "Seguir",
  qualified: "Calificado",
  not_interested: "Sin interés",
  disqualified: "Descalificado",
};

const yesNo = (value: boolean) => (value ? "Sí" : "No");

/** What the engine would store on the thread after the last test turn. */
export function AssistantTestLead({
  config,
  lead,
  lastTurn,
  className,
}: {
  config: CompanyConfig;
  lead: TestLead | null;
  lastTurn: Pick<TestTurnResponse, "model" | "usage"> | null;
  className?: string;
}) {
  const stage = lead?.stage ?? "qualifying";
  const stageMeta = stageMetaOf(stage, config.stages);
  const required = config.collect.filter((item) => item.required);
  const optional = config.collect.filter((item) => !item.required);
  const valueOf = (key: string) =>
    lead && Object.hasOwn(lead.collected, key) ? lead.collected[key]! : null;

  return (
    <Panel
      title="Estado del lead"
      description="Datos que guardaría el asistente."
      className={cn("min-h-0 overflow-y-auto", className)}
    >
      <Group title="Seguimiento">
        <Detail
          label="Etapa"
          value={
            <span className="inline-flex items-center gap-2">
              <StatusDot tone={stageMeta.tone} />
              {stageMeta.label}
            </span>
          }
        />
        <Detail
          label="Paso de la conversación"
          value={STATE_LABELS[lead?.state ?? "greeting"]}
        />
        <Detail label="Contacto preferido" value={lead?.callTime} />
      </Group>
      {required.length > 0 ? (
        <Group title="Necesario para Por contactar">
          {required.map((item) => (
            <Detail
              key={item.key}
              label={item.name}
              value={valueOf(item.key)}
              answered={Boolean(valueOf(item.key))}
            />
          ))}
        </Group>
      ) : null}
      {optional.length > 0 ? (
        <Group title="Opcional">
          {optional.map((item) => (
            <Detail
              key={item.key}
              label={item.name}
              value={valueOf(item.key)}
              answered={Boolean(valueOf(item.key))}
            />
          ))}
        </Group>
      ) : null}
      <Group title="Resumen">
        <p className="text-sm whitespace-pre-wrap text-pretty">
          {lead?.summary ?? (
            <span className="text-muted-foreground/70">Sin resumen aún.</span>
          )}
        </p>
      </Group>
      {lastTurn ? (
        <Group title="Último turno">
          {lastTurn.model ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              <dt className="text-muted-foreground">Intención</dt>
              <dd>
                {INTENT_LABELS[lastTurn.model.intent] ?? lastTurn.model.intent}
              </dd>
              <dt className="text-muted-foreground">Quiere hablar ya</dt>
              <dd>{yesNo(lastTurn.model.callNow)}</dd>
              <dt className="text-muted-foreground">Requiere asesor</dt>
              <dd>{yesNo(lastTurn.model.needsHuman)}</dd>
              <dt className="text-muted-foreground">Tema prohibido</dt>
              <dd className="wrap-break-word">
                {lastTurn.model.forbiddenTopic ?? "No"}
              </dd>
            </dl>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              El modelo no respondió.
            </p>
          )}
          {lastTurn.usage ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              {lastTurn.usage.model} ·{" "}
              {formatNumber(lastTurn.usage.inputTokens)} +{" "}
              {formatNumber(lastTurn.usage.outputTokens)} tokens ·{" "}
              {(lastTurn.usage.latencyMs / 1000).toLocaleString("es", {
                maximumFractionDigits: 1,
              })}{" "}
              s
            </p>
          ) : null}
        </Group>
      ) : null}
    </Panel>
  );
}
