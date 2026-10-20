"use client";

import type { ReactNode } from "react";
import {
  CheckIcon,
  CircleAlertIcon,
  HandIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";
import { cn } from "cn";
import { Panel, StatusPill, type Tone } from "@/components/panel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatPhone } from "@/lib/format";
import { needsHumanReasonLabel } from "@/lib/thread-status";
import type { LeadField, Thread } from "@/lib/types";
import { FollowUpGroup } from "./follow-up-group";
import { BotBadge } from "./status-badge";
import { useThreadActionWithToast } from "./use-thread-action";

function Group({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
        {aside}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Detail({
  label,
  value,
  answered,
  tag,
}: {
  label: string;
  value: ReactNode;
  /** Shows whether an item to collect is in. */
  answered?: boolean;
  tag?: string;
}) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex gap-2.5">
      {answered !== undefined ? (
        <span
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
            answered
              ? "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-dashed",
          )}
        >
          {answered ? <CheckIcon className="size-2.5" /> : null}
        </span>
      ) : null}
      <dl className="flex min-w-0 flex-col gap-0.5">
        <dt className="flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-muted-foreground">
          {label}
          {tag ? (
            <span className="text-[11px] text-muted-foreground/70">{tag}</span>
          ) : null}
        </dt>
        <dd className="text-sm break-words">
          {empty ? <span className="text-muted-foreground/70">—</span> : value}
        </dd>
      </dl>
    </div>
  );
}

const CRM_TONE: Record<Thread["crm"]["status"], Tone> = {
  synced: "ok",
  pending: "pending",
  failed: "error",
  none: "muted",
};

const CRM_SHORT: Record<Thread["crm"]["status"], string> = {
  synced: "Guardado",
  pending: "Guardando",
  failed: "Falló",
  none: "Sin guardar",
};

/** Something the operator has to act on, with the one action that fixes it. */
function AttentionBlock({
  tone,
  icon,
  text,
  detail,
  action,
}: {
  tone: "warning" | "error";
  icon: ReactNode;
  text: ReactNode;
  detail: ReactNode;
  action: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3",
        tone === "warning"
          ? "border-amber-500/30 bg-amber-500/5 [&_[data-slot=attention-icon]]:text-amber-600"
          : "border-destructive/30 bg-destructive/5 [&_[data-slot=attention-icon]]:text-destructive",
      )}
    >
      <div className="flex gap-2">
        <span
          data-slot="attention-icon"
          className="mt-0.5 shrink-0 [&_svg]:size-4"
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[13px] leading-relaxed break-words">{text}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {detail}
          </p>
        </div>
      </div>
      {action}
    </div>
  );
}

/** Only when the assistant is not answering: stopped for a person, or paused by an advisor. */
function AssistantGroup({ thread }: { thread: Thread }) {
  const { run, pending } = useThreadActionWithToast(thread.id);

  if (thread.needsHuman) {
    return (
      <Group title="Asistente" aside={<BotBadge activity="needs_human" />}>
        <AttentionBlock
          tone="warning"
          icon={<HandIcon />}
          text={needsHumanReasonLabel(thread.needsHumanReason)}
          detail="Contactá al lead desde tu WhatsApp y, cuando esté resuelto, devolvele la conversación al asistente."
          action={
            <Button
              size="sm"
              variant="outline"
              className="w-full bg-background"
              onClick={() => run("clear-needs-human")}
              disabled={pending !== null}
            >
              {pending === "clear-needs-human" ? <Spinner /> : <CheckIcon />}
              Marcar como atendida
            </Button>
          }
        />
      </Group>
    );
  }

  if (thread.paused) {
    return (
      <Group title="Asistente" aside={<BotBadge activity="paused" />}>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Un asesor pausó el asistente en esta conversación. Los mensajes nuevos
          se guardan, pero el asistente no responde.
        </p>
      </Group>
    );
  }

  return null;
}

function HubSpotGroup({ thread }: { thread: Thread }) {
  const { run, pending } = useThreadActionWithToast(thread.id);
  const { crm } = thread;

  return (
    <Group
      title="HubSpot"
      aside={
        <StatusPill tone={CRM_TONE[crm.status]}>
          {CRM_SHORT[crm.status]}
        </StatusPill>
      }
    >
      {crm.status === "failed" ? (
        <AttentionBlock
          tone="error"
          icon={<CircleAlertIcon />}
          text={crm.lastError ?? "Error desconocido."}
          detail={
            crm.retriesExhausted
              ? "Se agotaron los reintentos automáticos."
              : "Se reintenta solo en unos minutos."
          }
          action={
            <Button
              size="sm"
              variant="outline"
              className="w-full bg-background"
              onClick={() => run("crm-sync")}
              disabled={pending !== null}
            >
              {pending === "crm-sync" ? <Spinner /> : <RefreshCwIcon />}
              Reintentar
            </Button>
          }
        />
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {crm.status === "synced"
            ? `Contacto y conversación guardados el ${formatDateTime(crm.syncedAt)}.`
            : crm.status === "pending"
              ? "Guardando el contacto y la conversación…"
              : "Se guarda cuando el lead se deriva, la conversación se cierra o el asistente se detiene."}
        </p>
      )}
    </Group>
  );
}

/** The assistant's bullets, rewritten every turn. */
function SummaryGroup({ summary }: { summary: string | null }) {
  const bullets = (summary ?? "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
  return (
    <Group
      title="Resumen"
      aside={
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <SparklesIcon className="size-3" />
          Del asistente
        </span>
      }
    >
      {bullets.length > 0 ? (
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm leading-relaxed marker:text-muted-foreground/60">
          {bullets.map((bullet, index) => (
            <li key={index} className="break-words">
              {bullet}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Se arma con la primera respuesta del asistente.
        </p>
      )}
    </Group>
  );
}

export function LeadDetails({
  thread,
  fields,
}: {
  thread: Thread;
  /** The company's items with the lead's values, from the thread view. */
  fields: LeadField[];
}) {
  const asked = fields.filter((field) => field.required !== null);
  const required = asked.filter((field) => field.required);
  const requiredIn = required.filter((field) => field.value).length;
  // What needs action goes first; a HubSpot that is fine is reference, at the end.
  const crmFailed = thread.crm.status === "failed";

  return (
    <Panel title="Lead" className="flex min-h-0 flex-col">
      <div className="min-h-0 flex-1 divide-y overflow-y-auto">
        <AssistantGroup thread={thread} />
        <FollowUpGroup thread={thread} />
        {crmFailed ? <HubSpotGroup thread={thread} /> : null}
        <SummaryGroup summary={thread.summary} />
        <Group
          title="Datos del lead"
          aside={
            <span className="text-xs text-muted-foreground tabular-nums">
              {requiredIn} de {required.length} obligatorios
            </span>
          }
        >
          {fields.map((field) => (
            <Detail
              key={field.key}
              label={field.name}
              value={field.value}
              answered={
                field.required === null ? undefined : Boolean(field.value)
              }
              tag={
                field.required === null
                  ? "ya no se pide"
                  : field.required
                    ? undefined
                    : "opcional"
              }
            />
          ))}
          <Detail label="Horario para llamar" value={thread.callTime} />
        </Group>
        <Group title="Contacto">
          <Detail label="Teléfono" value={formatPhone(thread.phone)} />
          {thread.email ? <Detail label="Email" value={thread.email} /> : null}
          <Detail
            label="Origen"
            value={thread.source === "form" ? "Formulario" : "WhatsApp"}
          />
          <Detail
            label="Primer contacto"
            value={formatDateTime(thread.createdAt)}
          />
        </Group>
        {crmFailed ? null : <HubSpotGroup thread={thread} />}
      </div>
    </Panel>
  );
}
