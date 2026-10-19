"use client";

import { toast } from "sonner";
import { useThreadAction, type ThreadAction } from "@/lib/queries";

const SUCCESS: Record<ThreadAction, string> = {
  "clear-needs-human":
    "El asistente vuelve a responder desde el próximo mensaje del lead.",
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
          toast.error(
            `HubSpot sigue fallando: ${thread.crm.lastError ?? "error desconocido"}`,
          );
        } else {
          toast.success(SUCCESS[action]);
        }
      },
      onError: (error) => toast.error(error.message),
    });
  return { run, pending: mutation.isPending ? mutation.variables : null };
}
