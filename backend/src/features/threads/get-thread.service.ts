import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import { toThreadDto } from "./thread-dto.js";

const MAX_MESSAGES = 500;

export async function getThread(ctx: AppContext, companyId: string, threadId: string) {
  const thread = await ctx.db.thread.findFirst({ where: { id: threadId, companyId } });
  if (!thread) throw notFound("Conversación no encontrada");
  const messages = await ctx.db.message.findMany({
    where: { threadId },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: MAX_MESSAGES,
    select: { id: true, direction: true, type: true, body: true, status: true, sentAt: true },
  });
  return { thread: toThreadDto(thread), messages: messages.reverse() };
}
