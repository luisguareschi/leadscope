import {
  assistantStatusOf,
  type AssistantStatus,
} from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";

/**
 * Company-wide switch for automated assistant replies (WhatsApp turns and form welcomes).
 * Pausing marks currently pending inbound messages as handled so resuming never triggers a burst
 * of late replies, while leaving each thread's own `paused` and `needsHuman` flags intact.
 */
export async function setAssistantPaused(
  ctx: AppContext,
  companyId: string,
  paused: boolean,
  actorEmail: string,
): Promise<AssistantStatus> {
  const now = ctx.now();
  const updated = await ctx.db.$transaction(async (tx) => {
    const current = await tx.company.findUniqueOrThrow({
      where: { id: companyId },
      select: {
        assistantPaused: true,
        assistantPausedAt: true,
        assistantPausedByEmail: true,
      },
    });
    const company = await tx.company.update({
      where: { id: companyId },
      data: paused
        ? {
            assistantPaused: true,
            // Idempotent: keep who originally paused it if already paused.
            assistantPausedAt: current.assistantPaused
              ? (current.assistantPausedAt ?? now)
              : now,
            assistantPausedByEmail: current.assistantPaused
              ? (current.assistantPausedByEmail ?? actorEmail)
              : actorEmail,
          }
        : {
            assistantPaused: false,
            assistantPausedAt: null,
            assistantPausedByEmail: null,
          },
      select: {
        assistantPaused: true,
        assistantPausedAt: true,
        assistantPausedByEmail: true,
      },
    });
    if (paused) {
      await tx.message.updateMany({
        where: { companyId, direction: "inbound", handledAt: null },
        data: { handledAt: now },
      });
    }
    return company;
  });
  return assistantStatusOf(updated);
}
