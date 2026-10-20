"use client";

import { useState } from "react";
import { PhoneCallIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatWaiting } from "@/lib/format";
import { useMe } from "@/lib/queries";
import { operatorName } from "@/lib/thread-status";
import type { Thread } from "@/lib/types";
import { AssigneePicker } from "./assignee-picker";
import { BotBadge, StageBadge } from "./status-badge";
import { useThreadActionWithToast } from "./use-thread-action";

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
  const me = useMe();
  const { run, pending } = useThreadActionWithToast(thread.id);
  const [confirming, setConfirming] = useState(false);
  const canBeAssigned = me.data ? !me.data.supportAccess : false;
  const contacted = thread.stage === "contacted";

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <h4 className="text-xs font-medium text-muted-foreground">Seguimiento</h4>
      <div className="flex flex-col gap-1.5">
        <Row label="Etapa">
          <StageBadge stage={thread.stage} />
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
        {contacted ? (
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
      {contacted ? null : (
        <div>
          <Button
            size="sm"
            variant={thread.stage === "to_contact" ? "default" : "outline"}
            className={
              thread.stage === "to_contact" ? undefined : "bg-background"
            }
            onClick={() => setConfirming(true)}
            disabled={pending !== null}
          >
            {pending === "contacted" ? <Spinner /> : <PhoneCallIcon />}
            Marcar contactado
          </Button>
        </div>
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Ya hablaste con este lead?</AlertDialogTitle>
            <AlertDialogDescription>
              La conversación pasa a Contactado y queda registrado quién y
              cuándo.{" "}
              {!thread.assignee && canBeAssigned
                ? "Como no tenía a nadie asignado, queda asignada a vos. "
                : ""}
              El asistente sigue respondiendo sus preguntas sin volver a pedirle
              datos. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              onClick={() => {
                setConfirming(false);
                run("contacted");
              }}
            >
              Marcar contactado
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
