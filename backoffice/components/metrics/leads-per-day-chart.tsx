"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  STAGE_CHART_COLOR,
  STAGE_META,
  STAGE_ORDER,
} from "@/lib/thread-status";
import { formatCount, formatDay } from "@/lib/metrics-format";
import type { CompanyMetrics, LeadStage } from "@/lib/types";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Day = CompanyMetrics["leadsPerDay"][number];

const chartConfig = {
  qualifying: {
    label: STAGE_META.qualifying.label,
    color: STAGE_CHART_COLOR.qualifying,
  },
  to_contact: {
    label: STAGE_META.to_contact.label,
    color: STAGE_CHART_COLOR.to_contact,
  },
  contacted: {
    label: STAGE_META.contacted.label,
    color: STAGE_CHART_COLOR.contacted,
  },
  not_interested: {
    label: STAGE_META.not_interested.label,
    color: STAGE_CHART_COLOR.not_interested,
  },
} satisfies ChartConfig;

function dayTotal(day: Day): number {
  return day.qualifying + day.to_contact + day.contacted + day.not_interested;
}

function LeadsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: Day }>;
}) {
  const day = payload?.[0]?.payload;
  if (!active || !day) return null;
  const total = dayTotal(day);
  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-xl">
      <p className="font-medium">{formatDay(day.date, true)}</p>
      {STAGE_ORDER.map((stage) => (
        <div key={stage} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: STAGE_CHART_COLOR[stage] }}
            />
            {STAGE_META[stage].label}
          </span>
          <span className="font-medium tabular-nums">
            {formatCount(day[stage])}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 border-t border-border/70 pt-1.5">
        <span className="text-muted-foreground">Total</span>
        <span className="font-medium tabular-nums">{formatCount(total)}</span>
      </div>
    </div>
  );
}

export function LeadsPerDayChart({
  data,
  empty,
}: {
  data: Day[];
  /** No leads in the range: the chart is replaced by the empty line. */
  empty: boolean;
}) {
  const reduced = usePrefersReducedMotion();

  if (empty) {
    return (
      <p className="flex h-48 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Sin leads en este período.
      </p>
    );
  }

  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto h-72 w-full"
      initialDimension={{ width: 640, height: 288 }}
    >
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={(value: string) => formatDay(value)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={32}
          allowDecimals={false}
        />
        <ChartTooltip content={<LeadsTooltip />} />
        <ChartLegend content={<ChartLegendContent className="flex-wrap" />} />
        {STAGE_ORDER.map((stage) => (
          <Bar
            key={stage}
            dataKey={stage satisfies LeadStage}
            stackId="leads"
            fill={`var(--color-${stage})`}
            maxBarSize={28}
            isAnimationActive={!reduced}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
