import type { AppContext } from "../context.js";

const LEASE_MS = 2 * 60 * 1000;

/**
 * Runs `work` only if no other process holds this thread. Overlapping containers during a deploy
 * must not answer the same lead twice. An expired lease (a crashed process) can be taken over.
 */
export async function withThreadLease<T>(
  ctx: AppContext,
  threadId: string,
  work: () => Promise<T>,
): Promise<{ claimed: true; result: T } | { claimed: false }> {
  const now = ctx.now();
  const claim = await ctx.db.thread.updateMany({
    where: { id: threadId, OR: [{ processingUntil: null }, { processingUntil: { lt: now } }] },
    data: { processingUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (claim.count === 0) return { claimed: false };
  try {
    return { claimed: true, result: await work() };
  } finally {
    await ctx.db.thread.updateMany({ where: { id: threadId }, data: { processingUntil: null } });
  }
}
