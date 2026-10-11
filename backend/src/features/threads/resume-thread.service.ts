import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import { toThreadDto } from "./thread-dto.js";

/** The bot answers again from the next lead message, in the stage the thread had. */
export async function resumeThread(ctx: AppContext, companyId: string, threadId: string) {
  const updated = await ctx.db.thread.updateMany({
    where: { id: threadId, companyId },
    data: { paused: false, pausedAt: null },
  });
  if (updated.count === 0) throw notFound("Conversación no encontrada");
  return toThreadDto(await ctx.db.thread.findUniqueOrThrow({ where: { id: threadId } }));
}
