"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "cn";
import { Panel, StatusPill, type Tone } from "@/components/panel";
import { formatDateTime, formatPhone } from "@/lib/format";
import type { Thread } from "@/lib/types";
import { crmLabel } from "./crm-indicator";

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
}: {
  label: string;
  value: ReactNode;
  /** Shows whether one of the three qualifying answers is in. */
  answered?: boolean;
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
        <dt className="text-[13px] text-muted-foreground">{label}</dt>
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

export function LeadDetails({ thread }: { thread: Thread }) {
  const knows =
    thread.knowsProjects === null ? null : thread.knowsProjects ? "Sí" : "No";
  const answers = [thread.interest, thread.budget, knows].filter(
    (value) => value !== null && value !== "",
  ).length;

  return (
    <Panel title="Lead">
      <Group
        title="Calificación"
        aside={
          <span className="text-xs text-muted-foreground tabular-nums">
            {answers} de 3
          </span>
        }
      >
        <Detail
          label="Qué busca"
          value={thread.interest}
          answered={Boolean(thread.interest)}
        />
        <Detail
          label="Presupuesto"
          value={thread.budget}
          answered={Boolean(thread.budget)}
        />
        <Detail
          label="Conoce los proyectos"
          value={knows}
          answered={knows !== null}
        />
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
      <Group
        title="HubSpot"
        aside={
          <StatusPill tone={CRM_TONE[thread.crm.status]}>
            {CRM_SHORT[thread.crm.status]}
          </StatusPill>
        }
      >
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {crmLabel(thread.crm)}
        </p>
      </Group>
    </Panel>
  );
}
