"use client";

import { MessageCircleMoreIcon } from "lucide-react";
import { HelpTip } from "@/components/help-tip";
import { StatusDot, StatusPill, type Tone } from "@/components/panel";
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

const COLUMN_HELP: Record<
  "stage" | "bot",
  { label: string; intro: string; items: Record<string, Meta> }
> = {
  stage: {
    label: "Qué significa cada etapa",
    intro:
      "Dónde está el lead para el equipo de ventas. El asistente solo la mueve hacia adelante; cualquiera del equipo la puede cambiar, en cualquier sentido, haciendo clic en la etapa.",
    items: STAGE_META,
  },
  bot: {
    label: "Qué significa cada estado del asistente",
    intro: "Qué hace el asistente en la conversación, aparte de la etapa.",
    items: BOT_META,
  },
};

/** The "?" next to a column header: hovering or focusing it explains that column's values. */
export function ColumnHelp({ column }: { column: "stage" | "bot" }) {
  const help = COLUMN_HELP[column];
  return (
    <HelpTip
      label={help.label}
      className="flex-col items-start gap-2.5 leading-normal"
    >
      <p className="leading-relaxed text-background/80">{help.intro}</p>
      <ul className="flex flex-col gap-2">
        {Object.entries(help.items).map(([key, meta]) => (
          <li key={key} className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 font-medium">
              <StatusDot tone={meta.tone} className="size-1.5" />
              {meta.label}
            </span>
            <span className="leading-relaxed text-background/70">
              {meta.description}
            </span>
          </li>
        ))}
      </ul>
    </HelpTip>
  );
}
