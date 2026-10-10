"use client";

import { toast } from "sonner";
import { CircleAlertIcon, HandIcon, PauseCircleIcon, TimerOffIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { needsHumanReasonLabel } from "@/lib/thread-status";
import { useThreadAction, type ThreadAction } from "@/lib/queries";
import type { Thread } from "@/lib/types";

const SUCCESS: Record<ThreadAction, string> = {
  "clear-needs-human": "El asistente vuelve a responder desde el próximo mensaje del lead.",
  resume: "El asistente vuelve a responder desde el próximo mensaje del lead.",
  pause: "Pausaste el asistente en esta conversación.",
  "crm-sync": "Guardado en HubSpot.",
};

export function useThreadActionWithToast(threadId: string) {
  const mutation = useThreadAction(threadId);
  const run = (action: ThreadAction) =>
    mutation.mutate(action, {
      onSuccess: ({ thread }) => {
        if (action === "crm-sync" && thread.crm.status !== "synced") {
          toast.error(`HubSpot sigue fallando: ${thread.crm.lastError ?? "error desconocido"}`);
        } else {
          toast.success(SUCCESS[action]);
        }
      },
      onError: (error) => toast.error(error.message),
    });
  return { run, pending: mutation.isPending ? mutation.variables : null };
}

export function ThreadAlerts({ thread }: { thread: Thread }) {
  const { run, pending } = useThreadActionWithToast(thread.id);
  const windowClosed = thread.replyWindowClosesAt !== null && new Date(thread.replyWindowClosesAt) < new Date();

  return (
    <div className="flex flex-col gap-3">
      {thread.needsHuman ? (
        <Alert className="border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-200">
          <HandIcon />
          <AlertTitle>El asistente se detuvo y espera a una persona</AlertTitle>
          <AlertDescription className="text-amber-900/80 dark:text-amber-200/80">
            {needsHumanReasonLabel(thread.needsHumanReason)} Contactá al lead desde tu WhatsApp y, cuando esté resuelto,
            devolvele la conversación al asistente.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => run("clear-needs-human")} disabled={pending !== null}>
              {pending === "clear-needs-human" ? <Spinner /> : null}
              Marcar como atendida
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {thread.paused ? (
        <Alert>
          <PauseCircleIcon />
          <AlertTitle>Asistente pausado</AlertTitle>
          <AlertDescription>Un asesor tomó esta conversación. Los mensajes nuevos se guardan, pero el asistente no responde.</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => run("resume")} disabled={pending !== null}>
              {pending === "resume" ? <Spinner /> : null}
              Reanudar
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {thread.crm.status === "failed" ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>No se pudo guardar en HubSpot</AlertTitle>
          <AlertDescription>
            {thread.crm.lastError}
            {thread.crm.retriesExhausted ? " Se agotaron los reintentos automáticos." : " Se reintenta solo en unos minutos."}
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => run("crm-sync")} disabled={pending !== null}>
              {pending === "crm-sync" ? <Spinner /> : null}
              Reintentar
            </Button>
          </AlertAction>
        </Alert>
      ) : null}
      {windowClosed && !thread.paused && thread.state !== "closed" ? (
        <Alert>
          <TimerOffIcon />
          <AlertTitle>Pasaron más de 24 horas desde el último mensaje del lead</AlertTitle>
          <AlertDescription>WhatsApp no deja que el asistente le escriba hasta que el lead vuelva a escribir.</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
