"use client";

import { Button } from "@/components/ui/button";
import { RANGE_PRESETS, type RangePreset } from "@/lib/metrics-format";

export function RangePicker({
  value,
  onChange,
}: {
  value: RangePreset;
  onChange: (value: RangePreset) => void;
}) {
  return (
    <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
      {RANGE_PRESETS.map((preset) => {
        const selected = preset.id === value;
        return (
          <Button
            key={preset.id}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            onClick={() => onChange(preset.id)}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
}
