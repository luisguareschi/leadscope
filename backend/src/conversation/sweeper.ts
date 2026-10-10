import type { AppContext } from "../context.js";
import { MAX_CRM_ATTEMPTS } from "./crm-sync.js";
import { retryCrmSync } from "./process-thread.js";

const SWEEP_EVERY_MS = 30_000;

/**
 * Picks up work the in-memory scheduler does not know about: messages that arrived just before a
 * restart, turns a crashed process left behind, and CRM writes that failed and are due again.
 */
export async function sweepOnce(ctx: AppContext): Promise<{ scheduled: number; crmRetried: number }> {
  const now = ctx.now();
  const settledBefore = new Date(now.getTime() - ctx.env.REPLY_DEBOUNCE_MS - 5_000);

  const unanswered = await ctx.db.message.findMany({
    where: { direction: "inbound", handledAt: null, createdAt: { lt: settledBefore } },
    select: { threadId: true },
    distinct: ["threadId"],
    take: 100,
  });
  let scheduled = 0;
  for (const { threadId } of unanswered) {
    if (ctx.replies.isBusy(threadId)) continue;
    ctx.replies.schedule(threadId);
    scheduled += 1;
  }

  const dueCrm = await ctx.db.thread.findMany({
    where: {
      crmPendingAction: { not: null },
      crmAttempts: { lt: MAX_CRM_ATTEMPTS },
      OR: [{ crmNextAttemptAt: null }, { crmNextAttemptAt: { lte: now } }],
      processingUntil: null,
    },
    select: { id: true },
    take: 50,
  });
  for (const { id } of dueCrm) {
    if (ctx.replies.isBusy(id)) continue;
    await retryCrmSync(ctx, id);
  }
  return { scheduled, crmRetried: dueCrm.length };
}

export function startSweeper(ctx: AppContext): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sweepOnce(ctx);
    } catch (error) {
      ctx.logger.error({ err: error }, "sweep failed");
    } finally {
      running = false;
    }
  };
  void tick();
  const interval = setInterval(() => void tick(), SWEEP_EVERY_MS);
  return () => clearInterval(interval);
}
