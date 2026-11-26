"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { LiquidSegmentedControl } from "@/components/ui/segmented-control";
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
    <>
      <div className="hidden sm:block">
        <LiquidSegmentedControl
          aria-label="Período"
          value={value}
          onValueChange={(next) => onChange(next as RangePreset)}
          className="w-fit min-w-[26rem]"
          items={RANGE_PRESETS.map((preset) => ({
            value: preset.id,
            label: preset.label,
          }))}
        />
      </div>
      <div
        ref={stripRef}
        role="group"
        aria-label="Período"
        className="scrollbar-none scroll-fade-x -mx-4 flex flex-nowrap gap-1.5 overflow-x-auto px-4 sm:hidden"
      >
        {RANGE_PRESETS.map((preset) => {
          const selected = preset.id === value;
          return (
            <Button
              key={preset.id}
              type="button"
              size="sm"
              variant={selected ? "default" : "glass"}
              aria-pressed={selected}
              className="shrink-0"
              onClick={() => onChange(preset.id)}
            >
              {preset.label}
            </Button>
          );
        })}
      </div>
    </>
  );
}
