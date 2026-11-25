import type { AppContext } from "../../context.js";
import { removeStorageIfUnreferenced } from "../../integrations/storage/cleanup.js";
import { notFound } from "../../lib/http-error.js";

/** Deletes a lead's thread and messages when they ask for it (Ley 18.331). The CRM copy is handled in HubSpot. */
export async function deleteThread(
  ctx: AppContext,
  companyId: string,
  threadId: string,
): Promise<void> {
  const media = await ctx.db.message.findMany({
    where: { threadId, companyId, mediaPath: { not: null } },
    select: { mediaPath: true },
  });
  const deleted = await ctx.db.thread.deleteMany({
    where: { id: threadId, companyId },
  });
  if (deleted.count === 0) throw notFound("Conversación no encontrada");
  if (media.length > 0) {
    await removeStorageIfUnreferenced(
      ctx,
      media.map((m) => m.mediaPath),
    );
  }
}
