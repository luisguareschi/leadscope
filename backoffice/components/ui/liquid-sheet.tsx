"use client";

import type { ReactNode } from "react";
import {
  Sheet as LiquidGlassSheet,
  type SheetDetent,
} from "@onlymoein/liquidglass";
import { cn } from "cn";

/**
 * Native iOS 27 Liquid Glass draggable bottom sheet for mobile pickers and navigation.
 * Opens in the top layer, supports medium/large detents, and clears the iPhone home indicator.
 */
export function LiquidSheet({
  open,
  onOpenChange,
  title,
  detents = ["medium", "large"],
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  detents?: SheetDetent[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <LiquidGlassSheet
      open={open}
      onOpenChange={onOpenChange}
      detents={detents}
      aria-label={title}
      className={cn("text-foreground", className)}
    >
      <div className="flex h-full min-h-0 flex-col pb-[max(1rem,var(--safe-bottom))]">
        <div className="flex shrink-0 items-center justify-between px-5 pt-1 pb-2.5">
          <h2 className="font-heading text-[17px] font-semibold tracking-tight">
            {title}
          </h2>
        </div>
        <div
          data-lg-no-sheet-drag
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          {children}
        </div>
      </div>
    </LiquidGlassSheet>
  );
}
