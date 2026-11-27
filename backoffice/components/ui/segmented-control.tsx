"use client";

import {
  SegmentedControl,
  type SegmentedControlProps,
} from "@onlymoein/liquidglass";
import { cn } from "cn";

export function LiquidSegmentedControl({
  size = "default",
  className,
  ...props
}: SegmentedControlProps & {
  size?: "sm" | "default";
}) {
  return (
    <SegmentedControl
      data-size={size}
      className={cn("ls-segmented", className)}
      {...props}
    />
  );
}
