import type { AppContext } from "../../context.js";
import { HttpError, notFound } from "../../lib/http-error.js";
import { findThreadDto } from "./thread-dto.js";

/**
 * Gives the thread to an active operator of the same company, or to nobody (`operatorId` null).
 * Another company's operator is a 404, like any id outside the company.
 */
export async function assignThread(
  ctx: AppContext,
  companyId: string,
  threadId: string,
  operatorId: string | null,
) {
  if (operatorId) {
    const operator = await ctx.db.operator.findFirst({
      where: { id: operatorId, companyId },
      select: { archivedAt: true },
    });
    if (!operator) throw notFound("Operador no encontrado");
    if (operator.archivedAt)
      throw new HttpError(
        400,
        "Ese operador está archivado: no se le pueden asignar conversaciones.",
        "assignee_archived",
      );
  }
  const current = await ctx.db.thread.findFirst({
    where: { id: threadId, companyId },
    select: { assignedToId: true },
  });
  if (!current) throw notFound("Conversación no encontrada");
  if (current.assignedToId !== operatorId) {
    await ctx.db.thread.update({
      where: { id: threadId },
      data: {
        assignedToId: operatorId,
        assignedAt: operatorId ? ctx.now() : null,
      },
    });
  }
  return findThreadDto(ctx.db, threadId);
}
