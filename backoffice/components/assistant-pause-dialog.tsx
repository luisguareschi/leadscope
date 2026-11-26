"use client";

import { Alert as LiquidAlert } from "@onlymoein/liquidglass";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/format";
import { useSetAssistantPaused } from "@/lib/queries";

export function pausedByDetail(
  pausedAt: string | null | undefined,
  pausedByEmail: string | null | undefined,
): string | null {
  if (!pausedAt && !pausedByEmail) return null;
  if (pausedByEmail && pausedAt) {
    return `Pausado por ${pausedByEmail} el ${formatDateTime(pausedAt)}.`;
  }
  if (pausedByEmail) return `Pausado por ${pausedByEmail}.`;
  return `Pausado el ${formatDateTime(pausedAt!)}.`;
}

export function useToggleAssistantPaused() {
  const mutation = useSetAssistantPaused();
  const toggle = (paused: boolean, onDone?: () => void) => {
    mutation.mutate(paused, {
      onSuccess: () => {
        toast.success(
          paused
            ? "Asistente pausado para toda la empresa."
            : "Asistente reanudado.",
        );
        onDone?.();
      },
      onError: (error) => toast.error(error.message),
    });
  };
  return { toggle, isPending: mutation.isPending };
}

export function PauseAssistantDialog({
  open,
  onOpenChange,
  companyName,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName?: string;
  pending: boolean;
  onConfirm: () => void;
}) {
  return (
    <LiquidAlert
      open={open}
      onOpenChange={(next) => {
        if (!pending) onOpenChange(next);
      }}
      title={
        companyName
          ? `¿Pausar el asistente de ${companyName}?`
          : "¿Pausar el asistente para toda la empresa?"
      }
      message="El asistente dejará de responder mensajes de WhatsApp y de enviar bienvenidas de formularios. Los mensajes se seguirán guardando y podrás responder manualmente."
      actions={[
        { label: "Cancelar", role: "cancel" },
        {
          label: pending ? "Pausando…" : "Pausar",
          role: "destructive",
          onSelect: () => {
            if (!pending) onConfirm();
          },
        },
      ]}
    />
  );
}
