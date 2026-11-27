"use client";

import * as React from "react";
import {
  Switch as LiquidSwitch,
  type SwitchProps as LiquidSwitchProps,
} from "@onlymoein/liquidglass";
import { cn } from "cn";

function Switch({
  className,
  size = "default",
  style,
  ...props
}: LiquidSwitchProps & {
  size?: "sm" | "default";
}) {
  return (
    <LiquidSwitch
      data-slot="switch"
      data-size={size}
      style={
        size === "sm"
          ? ({ "--lg-scale": 0.3, ...style } as React.CSSProperties)
          : style
      }
      className={cn("shrink-0", className)}
      {...props}
    />
  );
}

export { Switch };
