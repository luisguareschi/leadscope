import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";

/** Deletes a lead's thread and messages when they ask for it (Ley 18.331). The CRM copy is handled in HubSpot. */
export async function deleteThread(ctx: AppContext, companyId: string, threadId: string): Promise<void> {
  const deleted = await ctx.db.thread.deleteMany({ where: { id: threadId, companyId } });
  if (deleted.count === 0) throw notFound("Conversación no encontrada");
}
