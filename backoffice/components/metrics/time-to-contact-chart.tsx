"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatCount,
  formatDay,
  formatDuration,
  formatHoursAxis,
} from "@/lib/metrics-format";
import type { CompanyMetrics } from "@/lib/types";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Week = CompanyMetrics["timeToContactPerWeek"][number];

type Point = Week & { hours: number | null };

const chartConfig = {
  hours: { label: "Mediana", color: "var(--chart-2)" },
} satisfies ChartConfig;

function WeekTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Point }>;
}) {
  const week = payload?.[0]?.payload;
  if (!active || !week) return null;
  return (
    <div className="grid min-w-40 gap-1 rounded-lg border border-border/50 bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-xl">
      <p className="font-medium">Semana del {formatDay(week.weekStart)}</p>
      {week.medianMinutes == null ? (
        <p className="text-muted-foreground">Sin leads contactados</p>
      ) : (
        <>
          <p className="tabular-nums">{formatDuration(week.medianMinutes)}</p>
          <p className="text-muted-foreground">
            {week.count === 1
              ? "1 lead contactado"
              : `${formatCount(week.count)} leads contactados`}
          </p>
        </>
      )}
    </div>
  );
}

export function TimeToContactChart({
  data,
  emptyLabel,
}: {
  data: Week[];
  /** Shown when no week has a median (no contacted leads, or no leads at all). */
  emptyLabel: string;
}) {
  const reduced = usePrefersReducedMotion();
  const points: Point[] = data.map((week) => ({
    ...week,
    hours: week.medianMinutes == null ? null : week.medianMinutes / 60,
  }));
  const hasLine = points.some((point) => point.hours != null);

  if (!hasLine) {
    return (
      <p className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-72 w-full"
      initialDimension={{ width: 640, height: 288 }}
    >
      <LineChart
        data={points}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={(value: string) => formatDay(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(value: number) => formatHoursAxis(value)}
        />
        <ChartTooltip content={<WeekTooltip />} />
        <Line
          dataKey="hours"
          stroke="var(--color-hours)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-hours)" }}
          connectNulls={false}
          isAnimationActive={!reduced}
        />
      </LineChart>
    </ChartContainer>
  );
}
