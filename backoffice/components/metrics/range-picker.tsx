"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { RANGE_PRESETS, type RangePreset } from "@/lib/metrics-format";

export function RangePicker({
  value,
  onChange,
}: {
  value: RangePreset;
  onChange: (value: RangePreset) => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Below `sm` the presets are one scrollable strip, so keep the chosen one in view.
  // Scrolls the strip only, never the page.
  useEffect(() => {
    const strip = stripRef.current;
    const button = strip?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!strip || !button || strip.scrollWidth <= strip.clientWidth) return;
    const stripBox = strip.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();
    const gutter = 16;
    if (buttonBox.left < stripBox.left + gutter) {
      strip.scrollBy({
        left: buttonBox.left - stripBox.left - gutter,
        behavior: "smooth",
      });
    } else if (buttonBox.right > stripBox.right - gutter) {
      strip.scrollBy({
        left: buttonBox.right - stripBox.right + gutter,
        behavior: "smooth",
      });
    }
  }, [value]);

  return (
    <div
      ref={stripRef}
      role="group"
      aria-label="Período"
      className="scrollbar-none scroll-fade-x -mx-4 flex flex-nowrap gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {RANGE_PRESETS.map((preset) => {
        const selected = preset.id === value;
        return (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            className="shrink-0"
            onClick={() => onChange(preset.id)}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}
