"use client";

import * as React from "react";
import { Progress as LiquidProgress } from "@onlymoein/liquidglass";
import { cn } from "cn";

function Progress({
  className,
  children,
  value = 0,
  "aria-label": ariaLabel,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & {
  value?: number | null;
  children?: React.ReactNode;
}) {
  const normalized = Math.max(0, Math.min(1, (value ?? 0) / 100));
  return (
    <div
      data-slot="progress"
      className={cn("flex w-full flex-wrap gap-2", className)}
      {...props}
    >
      {children}
      <LiquidProgress
        value={normalized}
        aria-label={ariaLabel}
        className="h-2! w-full rounded-full!"
      />
    </div>
  );
}

export { Progress };
