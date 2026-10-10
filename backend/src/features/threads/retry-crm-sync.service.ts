import type { AppContext } from "../../context.js";
import { retryCrmSync as retryWithLease } from "../../conversation/process-thread.js";
import { badRequest, notFound } from "../../lib/http-error.js";
import { toThreadDto } from "./thread-dto.js";

/** Lets an operator retry a failed CRM write right away instead of waiting for the next backoff. */
export async function retryCrmSync(ctx: AppContext, companyId: string, threadId: string) {
  const thread = await ctx.db.thread.findFirst({ where: { id: threadId, companyId } });
  if (!thread) throw notFound("Conversación no encontrada");
  if (!thread.crmPendingAction) throw badRequest("Esta conversación no tiene nada pendiente para el CRM.");
  await ctx.db.thread.update({ where: { id: threadId }, data: { crmAttempts: 0, crmNextAttemptAt: null } });
  await retryWithLease(ctx, threadId);
  return toThreadDto(await ctx.db.thread.findUniqueOrThrow({ where: { id: threadId } }));
}
