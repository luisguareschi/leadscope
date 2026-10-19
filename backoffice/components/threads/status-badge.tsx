"use client";

import { useState } from "react";
import { CircleHelpIcon } from "lucide-react";
import { StatusPill } from "@/components/panel";
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
import {
  displayStatus,
  FILTER_STATUSES,
  FILTERS,
  STATUS_META,
} from "@/lib/thread-status";
import type { Thread } from "@/lib/types";

/** The status pill; hovering it says what the status means. */
export function StatusBadge({
  thread,
  className,
}: {
  thread: Pick<Thread, "needsHuman" | "paused" | "state" | "callTime">;
  className?: string;
}) {
  const meta = STATUS_META[displayStatus(thread)];
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={className ?? "inline-flex"} />}>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{meta.description}</TooltipContent>
    </Tooltip>
  );
}

/** A help button that lists every status, grouped by the filter that shows it. */
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
            <DialogTitle>Estados de una conversación</DialogTitle>
            <DialogDescription>
              El asistente cambia el estado solo. Los filtros de arriba agrupan
              estos estados.
            </DialogDescription>
          </DialogHeader>
          <div className="-mx-1 flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-1">
            {FILTER_STATUSES.map((group) => (
              <section key={group.filter} className="flex flex-col gap-2.5">
                <h3 className="text-xs font-medium text-muted-foreground">
                  {FILTERS.find((item) => item.value === group.filter)?.label}
                </h3>
                <ul className="flex flex-col gap-2.5">
                  {group.statuses.map((status) => {
                    const meta = STATUS_META[status];
                    return (
                      <li
                        key={status}
                        className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-start gap-3"
                      >
                        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                        <p className="text-[13px] leading-relaxed text-muted-foreground">
                          {meta.description}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
