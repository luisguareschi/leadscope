"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert as LiquidAlert,
  Button as LiquidButton,
} from "@onlymoein/liquidglass";
import { toast } from "sonner";
import {
  EllipsisVerticalIcon,
  PauseIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
    <div className="flex items-center gap-1.5">
      {thread.paused ? (
        <LiquidButton
          variant="glass"
          size="small"
          className="!h-9 !gap-1.5 !px-3.5 !text-[13px] !font-semibold max-lg:!hidden"
          onClick={() => run("resume")}
          disabled={pending !== null}
          icon={
            pending === "resume" ? (
              <Spinner className="size-3.5" />
            ) : (
              <PlayIcon className="size-3.5" />
            )
          }
        >
          Reanudar asistente
        </LiquidButton>
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={
              <LiquidButton
                variant="glass"
                size="small"
                className="!h-9 !gap-1.5 !px-3.5 !text-[13px] !font-semibold max-lg:!hidden"
                onClick={() => run("pause")}
                disabled={pending !== null}
                icon={
                  pending === "pause" ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <PauseIcon className="size-3.5" />
                  )
                }
              />
            }
          >
            Pausar asistente
          </TooltipTrigger>
          <TooltipContent className="max-w-64">
            Pausa el asistente si vas a atender esta conversación por tu cuenta.
          </TooltipContent>
        </Tooltip>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <LiquidButton
              variant="glass"
              size="small"
              icon={<EllipsisVerticalIcon className="size-4.5" />}
              className="!size-9 !rounded-full max-lg:!size-10"
              aria-label="Más acciones"
            />
          }
        />
        <DropdownMenuContent align="end" className="min-w-52">
          {/* Below lg the pause button lives here instead of in the header. */}
          <DropdownMenuItem
            className="lg:hidden"
            disabled={pending !== null}
            onClick={() => run(thread.paused ? "resume" : "pause")}
          >
            {thread.paused ? <PlayIcon /> : <PauseIcon />}
            {thread.paused ? "Reanudar asistente" : "Pausar asistente"}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="lg:hidden" />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon />
            Eliminar conversación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LiquidAlert
        open={confirming}
        onOpenChange={(next) => {
          if (!remove.isPending) setConfirming(next);
        }}
        title="¿Eliminar esta conversación?"
        message="Se eliminará la conversación y todos sus mensajes en LeadScope. El contacto en HubSpot no se modifica."
        actions={[
          { label: "Cancelar", role: "cancel" },
          {
            label: remove.isPending ? "Eliminando…" : "Eliminar",
            role: "destructive",
            onSelect: () => {
              if (remove.isPending) return;
              remove.mutate(thread.id, {
                onSuccess: () => {
                  toast.success("Conversación eliminada.");
                  router.replace("/threads");
                },
                onError: (error) => toast.error(error.message),
              });
            },
          },
        ]}
      />
    </div>
  );
}
