import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBytes, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KnowledgeList } from "@/lib/types";

export function UsageCard({ usage, fileCount }: { usage: KnowledgeList["usage"]; fileCount: number }) {
  const percent = Math.min(100, Math.round((usage.usedChars / usage.maxCharsTotal) * 100));
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Espacio del asistente</CardTitle>
        <CardDescription>
          Todo el texto de estos archivos se le da al asistente en cada respuesta. Este es el máximo que entra.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span>
            <span className="font-semibold tabular-nums">{formatNumber(usage.usedChars)}</span>
            <span className="text-muted-foreground"> de {formatNumber(usage.maxCharsTotal)} caracteres</span>
          </span>
          <span className={cn("tabular-nums text-muted-foreground", percent >= 90 && "font-medium text-amber-700")}>
            {percent}%
          </span>
        </div>
        <Progress value={percent} aria-label="Espacio usado" />
        <p className="text-xs text-muted-foreground">
          {fileCount} {fileCount === 1 ? "archivo" : "archivos"} · Máximo por archivo: {formatNumber(usage.maxCharsPerFile)}{" "}
          caracteres de texto y {formatBytes(usage.maxFileBytes)}.
        </p>
      </CardContent>
    </Card>
  );
}
