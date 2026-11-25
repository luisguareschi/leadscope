"use client";

import { MessageCircleMoreIcon } from "lucide-react";
import { HelpTip } from "@/components/help-tip";
import {
  StatusDot,
  StatusPill,
  StatusText,
  type Tone,
} from "@/components/panel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSettings } from "@/lib/queries";
import { BOT_META, stageMetaOf, stagesForCompany } from "@/lib/thread-status";
import type { BotActivity, LeadStage, Thread } from "@/lib/types";

/** The lead stage pill; hovering it says what the stage means. */
export function StageBadge({ stage }: { stage: LeadStage }) {
  const settings = useSettings();
  const meta = stageMetaOf(stage, settings.data?.config.stages);
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{meta.description}</TooltipContent>
    </Tooltip>
  );
}

/** What the assistant is doing, independent of the stage. `text` is for list rows. */
export function BotBadge({
  activity,
  variant = "pill",
}: {
  activity: BotActivity;
  variant?: "pill" | "text";
}) {
  const meta = BOT_META[activity];
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>
        {variant === "text" ? (
          <StatusText tone={meta.tone}>{meta.label}</StatusText>
        ) : (
          <StatusPill tone={meta.tone} className="text-muted-foreground">
            {meta.label}
          </StatusPill>
        )}
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
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[11px] font-medium text-primary" />
        }
      >
        <MessageCircleMoreIcon className="size-3" />
        Escribió de nuevo
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {thread.stage === "contacted"
          ? "El lead escribió después de ser contactado."
          : "El lead volvió a escribir mientras espera contacto."}
      </TooltipContent>
    </Tooltip>
  );
}

type Meta = { label: string; tone: Tone; description: string };

/** The "?" next to a column header: hovering or focusing it explains that column's values. */
export function ColumnHelp({ column }: { column: "stage" | "bot" }) {
  const settings = useSettings();
  const stages = stagesForCompany(settings.data?.config.stages);
  const stageItems: Record<string, Meta> = Object.fromEntries(
    stages.map((stage) => [stage.key, stageMetaOf(stage.key, stages)]),
  );
  const help =
    column === "stage"
      ? {
          label: "Qué significa cada etapa",
          intro:
            "Estado del lead en el proceso comercial. Haz clic en una etapa para cambiarla.",
          items: stageItems,
        }
      : {
          label: "Qué significa cada estado del asistente",
          intro: "Estado actual del asistente en esta conversación.",
          items: BOT_META,
        };
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
