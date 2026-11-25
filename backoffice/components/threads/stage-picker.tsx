"use client";

import { toast } from "sonner";
import { cn } from "cn";
import { StatusDot } from "@/components/panel";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import { Spinner } from "@/components/ui/spinner";
import { useChangeStage, useSettings } from "@/lib/queries";
import { stageMetaOf, stagesForCompany } from "@/lib/thread-status";
import type { LeadStage, StageConfig, Thread } from "@/lib/types";

const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function matches(
  stage: LeadStage,
  query: string,
  stages: StageConfig[],
): boolean {
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  const label = fold(stageMetaOf(stage, stages).label);
  return words.every((word) => label.includes(word));
}

/**
 * The lead stage, and the one control to change it (Linear-style): any configured stage, in any
 * direction. Contactado records who and when; leaving it clears that. No confirmation.
 */
export function StagePicker({
  thread,
  size = "default",
}: {
  thread: Thread;
  /** `compact` fits a table cell. */
  size?: "default" | "compact";
}) {
  const settings = useSettings();
  const stages = stagesForCompany(settings.data?.config.stages);
  const stageKeys = stages.map((stage) => stage.key);
  const change = useChangeStage(thread.id);
  const meta = stageMetaOf(thread.stage, stages);
  const compact = size === "compact";

  const choose = (stage: LeadStage | null) => {
    if (!stage || stage === thread.stage) return;
    change.mutate(stage, {
      onError: (error) => toast.error(error.message),
      onSuccess: ({ thread: updated }) => {
        if (stage !== "contacted") {
          toast.success(`Etapa: ${stageMetaOf(stage, stages).label}.`);
          return;
        }
        const assignedNow = !thread.assignee && updated.assignee;
        toast.success(
          assignedNow
            ? "Marcada como contactada y asignada a ti."
            : "Marcada como contactada.",
        );
      },
    });
  };

  return (
    <Combobox
      items={stageKeys}
      value={thread.stage}
      onValueChange={choose}
      itemToStringLabel={(stage: LeadStage) => stageMetaOf(stage, stages).label}
      filter={(stage, query) => matches(stage, query, stages)}
      autoHighlight
    >
      <ComboboxTrigger
        aria-label={`Etapa: ${meta.label}. Cambiar etapa`}
        render={
          <Button
            variant={compact ? "ghost" : "outline"}
            size="sm"
            disabled={change.isPending}
            className={cn(
              "max-w-full min-w-0 justify-start gap-1.5 font-normal",
              compact ? "-ml-2 h-7 px-2" : "font-medium",
            )}
          />
        }
      >
        {change.isPending ? (
          <Spinner className="size-4" />
        ) : (
          <StatusDot tone={meta.tone} />
        )}
        <span className="truncate text-[13px]">{meta.label}</span>
      </ComboboxTrigger>
      <ComboboxContent className="w-56 min-w-56" align="start">
        <ComboboxInput showTrigger={false} placeholder="Cambiar etapa…" />
        <ComboboxEmpty>No hay coincidencias.</ComboboxEmpty>
        <ComboboxList>
          {(stage: LeadStage) => {
            const item = stageMetaOf(stage, stages);
            return (
              <ComboboxItem key={stage} value={stage}>
                <StatusDot tone={item.tone} />
                <span className="truncate">{item.label}</span>
              </ComboboxItem>
            );
          }}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
