"use client";

import { useState } from "react";
import { CircleHelpIcon, MessageCircleMoreIcon } from "lucide-react";
import { StatusPill, type Tone } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BOT_META, STAGE_META } from "@/lib/thread-status";
import type { BotActivity, LeadStage, Thread } from "@/lib/types";

/** The lead stage pill; hovering it says what the stage means. */
export function StageBadge({ stage }: { stage: LeadStage }) {
  const meta = STAGE_META[stage];
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{meta.description}</TooltipContent>
    </Tooltip>
  );
}

/** What the assistant is doing, independent of the stage. */
export function BotBadge({ activity }: { activity: BotActivity }) {
  const meta = BOT_META[activity];
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <StatusPill tone={meta.tone} className="text-muted-foreground">
          {meta.label}
        </StatusPill>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{meta.description}</TooltipContent>
    </Tooltip>
  );
}

/** The lead wrote after the handoff (or after being contacted): someone should read it. */
export function WroteAgainBadge({
  thread,
}: {
  thread: Pick<Thread, "wroteAgain" | "stage">;
}) {
  if (!thread.wroteAgain) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300" />
        }
      >
        <MessageCircleMoreIcon className="size-3" />
        Escribió de nuevo
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {thread.stage === "contacted"
          ? "El lead escribió después de que lo marcaran como contactado."
          : "El lead escribió después de pasar a Por contactar. Sigue en la cola."}
      </TooltipContent>
    </Tooltip>
  );
}

type Meta = { label: string; tone: Tone; description: string };

function LegendList({
  title,
  items,
}: {
  title: string;
  items: Record<string, Meta>;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {Object.entries(items).map(([key, meta]) => (
          <li
            key={key}
            className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-3"
          >
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {meta.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A help button that explains the two things every thread shows: stage and assistant. */
export function StatusLegendButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground"
        aria-label="Qué significa cada estado"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <CircleHelpIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Etapa y asistente</DialogTitle>
            <DialogDescription>
              La etapa solo avanza: el asistente pasa al lead a Por contactar
              cuando tiene los datos obligatorios, y un asesor lo marca como
              contactado. Lo que hace el asistente se muestra aparte.
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-1 flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-1">
            <LegendList title="Etapa del lead" items={STAGE_META} />
            <LegendList title="Asistente" items={BOT_META} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
