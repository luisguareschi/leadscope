"use client";

import type { ReactNode } from "react";
import { CircleHelpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "cn";

/** A "?" next to a label: hovering or focusing it shows the explanation. */
export function HelpTip({
  label,
  children,
  className,
}: {
  /** What the button is for, for screen readers. */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <CircleHelpIcon />
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        className={cn("max-w-80 p-3 leading-relaxed", className)}
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
