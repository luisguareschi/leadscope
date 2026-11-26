import { Panel } from "@/components/panel";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KnowledgeList } from "@/lib/types";

function Cell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1.5 @2xl/content:px-5 @2xl/content:py-4",
        className,
      )}
    >
      <span className="text-[13px] text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

/** Every file's text goes into each reply, so this is the space the assistant has. */
export function UsageCard({
  usage,
  fileCount,
}: {
  usage: KnowledgeList["usage"];
  fileCount: number;
}) {
  const percent = Math.min(
    100,
    Math.round((usage.usedChars / usage.maxCharsTotal) * 100),
  );
  const high = percent >= 90;
  return (
    <Panel>
      <div className="grid grid-cols-1 divide-y @2xl/content:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] @2xl/content:divide-x @2xl/content:divide-y-0">
        <Cell label="Espacio utilizado" className="px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm tabular-nums">
              <span className="font-heading text-2xl font-medium tracking-tight">
                {formatNumber(usage.usedChars)}
              </span>
              <span className="text-muted-foreground">
                {" "}
                / {formatNumber(usage.maxCharsTotal)} caracteres
              </span>
            </span>
            <span
              className={cn(
                "text-xs tabular-nums",
                high ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              {percent}%
            </span>
          </div>
          <Progress
            value={percent}
            aria-label="Espacio usado"
            className={cn(
              "mt-1",
              high && "**:data-[slot=progress-indicator]:bg-primary",
            )}
          />
        </Cell>
        {/* Below @2xl one strip of two cells; from @2xl up they join the row above. */}
        <div className="grid grid-cols-2 divide-x @2xl/content:contents">
          <Cell
            label="Archivos"
            className="gap-1 px-4 py-3 @2xl/content:gap-1.5"
          >
            <span className="font-heading text-xl font-medium tracking-tight tabular-nums @2xl/content:text-2xl">
              {formatNumber(fileCount)}
            </span>
          </Cell>
          <Cell
            label="Máximo por archivo"
            className="gap-1 px-4 py-3 @2xl/content:gap-1.5"
          >
            <span className="text-[13px] leading-snug tabular-nums @2xl/content:truncate @2xl/content:text-sm @2xl/content:leading-8">
              {formatNumber(usage.maxCharsPerFile)} caracteres ·{" "}
              {formatBytes(usage.maxFileBytes)}
            </span>
          </Cell>
        </div>
      </div>
    </Panel>
  );
}
