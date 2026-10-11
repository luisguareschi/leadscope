import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { displayStatus, STATUS_META } from "@/lib/thread-status";
import type { Thread } from "@/lib/types";

export function StatusBadge({ thread, className }: { thread: Pick<Thread, "needsHuman" | "paused" | "state" | "callTime">; className?: string }) {
  const meta = STATUS_META[displayStatus(thread)];
  return (
    <Badge variant="secondary" className={cn("border-transparent font-medium", meta.className, className)}>
      {meta.label}
    </Badge>
  );
}
