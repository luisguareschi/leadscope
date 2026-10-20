import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { conflict, notFound } from "../../lib/http-error.js";
import { findThreadDto } from "./thread-dto.js";

/**
 * An advisor reached the lead on their own WhatsApp or phone. Records who and when, and gives the
 * thread to that operator if nobody had it. Contactado is final: the bot keeps answering but never
 * moves the stage again.
 */
export async function markContacted(
  ctx: AppContext,
  access: CompanyAccess,
  threadId: string,
) {
  const { companyId, operatorId, actorEmail } = access;
  const current = await ctx.db.thread.findFirst({
    where: { id: threadId, companyId },
    select: { assignedToId: true },
  });
  if (!current) throw notFound("Conversación no encontrada");
  const now = ctx.now();
  const updated = await ctx.db.thread.updateMany({
    where: { id: threadId, stage: { not: "contacted" } },
    data: {
      stage: "contacted",
      contactedAt: now,
      contactedById: operatorId,
      contactedByEmail: actorEmail,
      ...(current.assignedToId === null && operatorId
        ? { assignedToId: operatorId, assignedAt: now }
        : {}),
    },
  });
  if (updated.count === 0)
    throw conflict(
      "Esta conversación ya está marcada como contactada.",
      "already_contacted",
    );
  return findThreadDto(ctx.db, threadId);
}
