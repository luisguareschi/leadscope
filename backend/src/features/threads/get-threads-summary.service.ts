import type { AppContext } from "../../context.js";
import { statusWhere, type ThreadStatusFilter } from "./thread-dto.js";

const BUCKETS = ["active", "handoff", "needs_human", "paused", "closed"] as const satisfies ThreadStatusFilter[];

/** Thread counts per status for the cards at the top of the panel. */
export async function getThreadsSummary(ctx: AppContext, companyId: string) {
  const counts = await Promise.all(
    BUCKETS.map((status) => ctx.db.thread.count({ where: { companyId, ...statusWhere(status) } })),
  );
  const byStatus = Object.fromEntries(BUCKETS.map((status, index) => [status, counts[index] ?? 0])) as Record<
    (typeof BUCKETS)[number],
    number
  >;
  const total = counts.reduce((sum, count) => sum + count, 0);
  return { total, ...byStatus };
}
