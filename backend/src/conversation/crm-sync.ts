import { loadCompany } from "../companies/load-company.js";
import type { AppContext } from "../context.js";
import { buildCrmSummary } from "./crm-summary.js";

const MAX_BACKOFF_MS = 60 * 60 * 1000;
export const MAX_CRM_ATTEMPTS = 12;

function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 60_000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Writes the thread's pending CRM action (contact upsert + summary). Call it while holding the
 * thread lease. A failure is recorded on the thread and retried later by the sweeper.
 */
export async function syncThreadToCrm(ctx: AppContext, threadId: string): Promise<"synced" | "failed" | "nothing"> {
  const thread = await ctx.db.thread.findUnique({ where: { id: threadId }, include: { company: true } });
  if (!thread?.crmPendingAction) return "nothing";
  const action = thread.crmPendingAction;
  try {
    const company = loadCompany(thread.company, ctx.encryptionKey);
    const messages = await ctx.db.message.findMany({
      where: { threadId },
      orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
      select: { direction: true, type: true, body: true, sentAt: true },
    });
    const summary = buildCrmSummary({ action, thread, messages, config: company.config, now: ctx.now() });
    const { contactId } = await ctx.integrations.crmFor(company).upsertLead({
      phone: thread.phone,
      name: thread.name,
      email: thread.email,
      existingContactId: thread.crmContactId,
      summary,
    });
    await ctx.db.thread.update({
      where: { id: threadId },
      data: {
        crmContactId: contactId,
        crmPendingAction: null,
        crmAttempts: 0,
        crmNextAttemptAt: null,
        crmLastError: null,
        crmSyncedAt: ctx.now(),
      },
    });
    return "synced";
  } catch (error) {
    const attempts = thread.crmAttempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.error({ err: error, threadId, companyId: thread.companyId, attempts }, "crm sync failed");
    await ctx.db.thread.update({
      where: { id: threadId },
      data: {
        crmAttempts: attempts,
        crmLastError: message.slice(0, 500),
        crmNextAttemptAt: new Date(ctx.now().getTime() + backoffMs(attempts)),
      },
    });
    return "failed";
  }
}
