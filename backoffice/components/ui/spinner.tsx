"use client";

import type { ComponentProps } from "react";
import { Spinner as LiquidSpinner } from "@onlymoein/liquidglass";
import { cn } from "cn";

function Spinner({
  className,
  "aria-label": ariaLabel = "Cargando",
  ...props
}: ComponentProps<typeof LiquidSpinner>) {
  return (
    <LiquidSpinner
      data-slot="spinner"
      aria-label={ariaLabel}
      className={cn("ls-spinner size-4 shrink-0", className)}
      {...props}
    />
  );
}

export { Spinner };
