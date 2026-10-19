import { Panel } from "@/components/panel";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KnowledgeList } from "@/lib/types";

function Cell({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-4">
      <span className="text-xs text-muted-foreground">{label}</span>
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
        <Cell label="Texto que lee el asistente en cada respuesta">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm tabular-nums">
              <span className="font-medium">
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
                high
                  ? "font-medium text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground",
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
              high && "[&_[data-slot=progress-indicator]]:bg-amber-500",
            )}
          />
        </Cell>
        <Cell label="Archivos">
          <span className="text-sm font-medium tabular-nums">
            {formatNumber(fileCount)}
          </span>
        </Cell>
        <Cell label="Máximo por archivo">
          <span className="truncate text-sm tabular-nums">
            {formatNumber(usage.maxCharsPerFile)} caracteres ·{" "}
            {formatBytes(usage.maxFileBytes)}
          </span>
        </Cell>
      </div>
    </Panel>
  );
}
