"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PauseIcon, PlayIcon, Trash2Icon } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime, formatTime } from "@/lib/format";
import { useDeleteThread } from "@/lib/queries";
import type { Thread } from "@/lib/types";
import { crmLabel } from "./crm-indicator";
import { useThreadActionWithToast } from "./thread-alerts";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function replyWindowText(closesAt: string | null): string {
  if (!closesAt) return "Cerrada (el lead no escribió todavía)";
  return new Date(closesAt) > new Date() ? `Abierta hasta las ${formatTime(closesAt)}` : "Cerrada";
}

export function LeadDetails({ thread }: { thread: Thread }) {
  const router = useRouter();
  const { run, pending } = useThreadActionWithToast(thread.id);
  const remove = useDeleteThread();
  const [confirming, setConfirming] = useState(false);

  const knows = thread.knowsProjects === null ? null : thread.knowsProjects ? "Sí" : "No";

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Datos del lead</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid gap-3">
          <Detail label="Interés" value={thread.interest} />
          <Detail label="Presupuesto" value={thread.budget} />
          <Detail label="Conoce los proyectos" value={knows} />
          <Detail label="Horario para llamar" value={thread.callTime} />
          {thread.email ? <Detail label="Email" value={thread.email} /> : null}
          <Detail label="Origen" value={thread.source === "form" ? "Formulario" : "WhatsApp"} />
        </dl>
        <Separator />
        <dl className="grid gap-3">
          <Detail label="HubSpot" value={crmLabel(thread.crm)} />
          <Detail label="Ventana de respuesta de WhatsApp" value={replyWindowText(thread.replyWindowClosesAt)} />
          <Detail label="Primer contacto" value={formatDateTime(thread.createdAt)} />
        </dl>
        <Separator />
        <div className="flex flex-col gap-2">
          {thread.paused ? (
            <Button variant="outline" onClick={() => run("resume")} disabled={pending !== null}>
              {pending === "resume" ? <Spinner /> : <PlayIcon />}
              Reanudar asistente
            </Button>
          ) : (
            <Button variant="outline" onClick={() => run("pause")} disabled={pending !== null}>
              {pending === "pause" ? <Spinner /> : <PauseIcon />}
              Pausar asistente
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Pausá cuando un asesor tome la conversación desde su WhatsApp, así el asistente no se mete.
          </p>
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
            <Trash2Icon />
            Eliminar conversación
          </Button>
        </div>
      </CardContent>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran la conversación y todos sus mensajes de LeadScope. Usalo cuando el lead pide que borremos sus datos
              (Ley 18.331). El contacto en HubSpot no se modifica.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(thread.id, {
                  onSuccess: () => {
                    toast.success("Conversación eliminada.");
                    router.replace("/threads");
                  },
                  onError: (error) => toast.error(error.message),
                })
              }
            >
              {remove.isPending ? <Spinner /> : null}
              Eliminar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
