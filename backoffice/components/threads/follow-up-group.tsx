"use client";

import { formatDateTime, formatWaiting } from "@/lib/format";
import { operatorName } from "@/lib/thread-status";
import type { Thread } from "@/lib/types";
import { AssigneePicker } from "./assignee-picker";
import { StagePicker } from "./stage-picker";
import { BotBadge } from "./status-badge";

function waitingLabel(since: string | null): string {
  const waiting = formatWaiting(since);
  return waiting === "recién" ? "recién llegado" : `lleva ${waiting} esperando`;
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-7 grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Where the lead is for the sales team, what the assistant is doing, and who has the lead. */
export function FollowUpGroup({ thread }: { thread: Thread }) {
  const change = thread.stageChange;
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <h4 className="text-xs font-medium text-muted-foreground">Seguimiento</h4>
      <div className="flex flex-col gap-1.5">
        <Row label="Etapa">
          <StagePicker thread={thread} size="compact" />
        </Row>
        <Row label="Asistente">
          <BotBadge activity={thread.botActivity} />
        </Row>
        <Row label="Asignado">
          <span className="flex min-w-0 items-center gap-2">
            <AssigneePicker thread={thread} size="compact" />
            {thread.assignedAt ? (
              <span className="shrink-0 text-xs text-muted-foreground">
                desde {formatDateTime(thread.assignedAt)}
              </span>
            ) : null}
          </span>
        </Row>
        {change ? (
          <Row label="Cambio de etapa">
            {formatDateTime(change.at)}
            <span className="text-muted-foreground">
              {" "}
              · {change.by ? operatorName(change.by) : "el asistente"}
            </span>
          </Row>
        ) : null}
        {thread.handedOffAt ? (
          <Row label="Por contactar">
            {formatDateTime(thread.handedOffAt)}
            {thread.stage === "to_contact" ? (
              <span className="text-muted-foreground">
                {" "}
                · {waitingLabel(thread.handedOffAt)}
              </span>
            ) : null}
          </Row>
        ) : null}
        {thread.stage === "contacted" ? (
          <Row label="Contactado">
            {formatDateTime(thread.contactedAt)}
            {thread.contactedBy ? (
              <span className="text-muted-foreground">
                {" "}
                · {operatorName(thread.contactedBy)}
              </span>
            ) : null}
          </Row>
        ) : null}
      </div>
    </div>
  );
}
