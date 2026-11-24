"use client";

import { toast } from "sonner";
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
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {companyName
              ? `¿Pausar el asistente de ${companyName}?`
              : "¿Pausar el asistente para toda la empresa?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            El asistente dejará de responder mensajes de WhatsApp y de enviar
            bienvenidas de formularios. Los mensajes se seguirán guardando y
            podrás responder manualmente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner /> : null}
            Pausar asistente
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
