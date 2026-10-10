import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import { toThreadDto } from "./thread-dto.js";

/** A person takes over: the bot stores new messages but does not answer them. */
export async function pauseThread(ctx: AppContext, companyId: string, threadId: string) {
  const updated = await ctx.db.thread.updateMany({
    where: { id: threadId, companyId },
    data: { paused: true, pausedAt: ctx.now() },
  });
  if (updated.count === 0) throw notFound("Conversación no encontrada");
  // Messages that were waiting for the bot belong to the person now.
  await ctx.db.message.updateMany({
    where: { threadId, direction: "inbound", handledAt: null },
    data: { handledAt: ctx.now() },
  });
  return toThreadDto(await ctx.db.thread.findUniqueOrThrow({ where: { id: threadId } }));
}
