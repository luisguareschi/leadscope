"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  EllipsisVerticalIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDeleteThread } from "@/lib/queries";
import type { Thread } from "@/lib/types";
import { useThreadActionWithToast } from "./use-thread-action";

export function ThreadActions({ thread }: { thread: Thread }) {
  const router = useRouter();
  const { run, pending } = useThreadActionWithToast(thread.id);
  const remove = useDeleteThread();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center gap-1">
      {thread.paused ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => run("resume")}
          disabled={pending !== null}
        >
          {pending === "resume" ? <Spinner /> : <PlayIcon />}
          Reanudar asistente
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                onClick={() => run("pause")}
                disabled={pending !== null}
              />
            }
          >
            {pending === "pause" ? <Spinner /> : <PauseIcon />}
            Pausar asistente
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Cuando un asesor toma la conversación desde su WhatsApp, así el
            asistente no se mete. Escribirle al lead desde el panel ya lo pausa.
          </TooltipContent>
        </Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label="Más acciones" />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon />
            Eliminar conversación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta conversación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran la conversación y todos sus mensajes de LeadScope. Usalo
              cuando el lead pide que borremos sus datos (Ley 18.331). El
              contacto en HubSpot no se modifica.
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
    </div>
  );
}
