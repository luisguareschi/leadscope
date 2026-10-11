import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import { toThreadDto } from "./thread-dto.js";

/** An operator dealt with what made the bot stop. The bot answers again from the next lead message. */
export async function clearNeedsHuman(ctx: AppContext, companyId: string, threadId: string) {
  const updated = await ctx.db.thread.updateMany({
    where: { id: threadId, companyId },
    data: { needsHuman: false, needsHumanReason: null },
  });
  if (updated.count === 0) throw notFound("Conversación no encontrada");
  return toThreadDto(await ctx.db.thread.findUniqueOrThrow({ where: { id: threadId } }));
}
