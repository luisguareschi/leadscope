import { StatusPill } from "@/components/panel";
import { displayStatus, STATUS_META } from "@/lib/thread-status";
import type { Thread } from "@/lib/types";

export function StatusBadge({
  thread,
  className,
}: {
  thread: Pick<Thread, "needsHuman" | "paused" | "state" | "callTime">;
  className?: string;
}) {
  const meta = STATUS_META[displayStatus(thread)];
  return (
    <StatusPill tone={meta.tone} className={className}>
      {meta.label}
    </StatusPill>
  );
}
