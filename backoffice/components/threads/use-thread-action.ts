"use client";

import { toast } from "sonner";
import { useMe, useThreadAction, type ThreadAction } from "@/lib/queries";

const SUCCESS: Record<ThreadAction, string> = {
  "clear-needs-human": "Conversación atendida. Asistente activo.",
  resume: "Asistente reanudado.",
  pause: "Asistente pausado.",
  "crm-sync": "Sincronizado con HubSpot.",
  take: "Conversación asignada a ti.",
};

export function useThreadActionWithToast(threadId: string) {
  const me = useMe();
  const mutation = useThreadAction(threadId);
  const companyPaused = me.data?.company?.assistantPaused === true;
  const run = (action: ThreadAction) =>
    mutation.mutate(action, {
      onSuccess: ({ thread }) => {
        if (action === "crm-sync" && thread.crm?.status !== "synced") {
          toast.error(
            `Error al sincronizar con HubSpot: ${thread.crm?.lastError ?? "error desconocido"}`,
          );
        } else if (
          companyPaused &&
          (action === "resume" || action === "clear-needs-human")
        ) {
          toast.success(
            "Conversación atendida. El asistente responderá cuando lo reanudes para la empresa.",
          );
        } else {
          toast.success(SUCCESS[action]);
        }
      },
      onError: (error) => toast.error(error.message),
    });
  return { run, pending: mutation.isPending ? mutation.variables : null };
}
