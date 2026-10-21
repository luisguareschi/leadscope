import { loadCompany } from "../companies/load-company.js";
import type { AppContext } from "../context.js";
import type { CrmActionKind } from "../engine/types.js";
import type { Prisma } from "../generated/prisma/client.js";
import { buildCrmSummary } from "./crm-summary.js";

const MAX_BACKOFF_MS = 60 * 60 * 1000;
export const MAX_CRM_ATTEMPTS = 12;
const CRM_LEASE_MS = 2 * 60 * 1000;
/** Writes in a row for one thread while turns keep asking for newer ones; the sweeper does the rest. */
const MAX_WRITES_PER_RUN = 5;

function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, 60_000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Thread fields that put a CRM write in the outbox. A newer request replaces an older one: the
 * text is built from the thread when the write runs, and the retry count starts over.
 */
export function crmRequest(action: CrmActionKind) {
  return {
    crmPendingAction: action,
    crmRequestVersion: { increment: 1 },
    crmAttempts: 0,
    crmNextAttemptAt: null,
  } satisfies Prisma.ThreadUpdateInput;
}

/**
 * Writes the thread's pending CRM action (contact upsert + summary). Call it while holding the CRM
 * lease. A failure is recorded on the thread and retried later by the sweeper. "changed" means a
 * newer request arrived while this one was being written, so it is still pending.
 */
export async function syncThreadToCrm(
  ctx: AppContext,
  threadId: string,
): Promise<"synced" | "changed" | "failed" | "nothing"> {
  const thread = await ctx.db.thread.findUnique({
    where: { id: threadId },
    include: { company: true },
  });
  if (!thread?.crmPendingAction) return "nothing";
  // Backing off after a failure; a new request (or Reintentar) clears this.
  if (thread.crmNextAttemptAt && thread.crmNextAttemptAt > ctx.now())
    return "nothing";
  const version = thread.crmRequestVersion;
  try {
    const company = loadCompany(thread.company, ctx.encryptionKey);
    const messages = await ctx.db.message.findMany({
      where: { threadId },
      orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
      select: { direction: true, type: true, body: true, sentAt: true },
    });
    const summary = buildCrmSummary({
      thread,
      messages,
      config: company.config,
      now: ctx.now(),
    });
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
        crmAttempts: 0,
        crmLastError: null,
        crmSyncedAt: ctx.now(),
      },
    });
    const cleared = await ctx.db.thread.updateMany({
      where: { id: threadId, crmRequestVersion: version },
      data: { crmPendingAction: null, crmNextAttemptAt: null },
    });
    return cleared.count > 0 ? "synced" : "changed";
  } catch (error) {
    const attempts = thread.crmAttempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.error(
      { err: error, threadId, companyId: thread.companyId, attempts },
      "crm sync failed",
    );
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

/**
 * Runs the thread's pending CRM writes under the CRM lease, so two processes never write (or
 * create) the same contact at once. It is a different lease from the turn's: replies never wait
 * for HubSpot. Returns false when another process holds it; that one, or the sweeper, writes.
 */
export async function syncWithCrmLease(
  ctx: AppContext,
  threadId: string,
): Promise<boolean> {
  const now = ctx.now();
  const claim = await ctx.db.thread.updateMany({
    where: {
      id: threadId,
      OR: [{ crmLeaseUntil: null }, { crmLeaseUntil: { lt: now } }],
    },
    data: { crmLeaseUntil: new Date(now.getTime() + CRM_LEASE_MS) },
  });
  if (claim.count === 0) return false;
  try {
    for (let run = 0; run < MAX_WRITES_PER_RUN; run += 1) {
      if ((await syncThreadToCrm(ctx, threadId)) !== "changed") break;
    }
    return true;
  } finally {
    await ctx.db.thread.updateMany({
      where: { id: threadId },
      data: { crmLeaseUntil: null },
    });
  }
}
