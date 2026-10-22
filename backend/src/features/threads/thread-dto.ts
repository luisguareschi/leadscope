import type { Prisma } from "../../generated/prisma/client.js";
import { MAX_CRM_ATTEMPTS } from "../../conversation/crm-sync.js";
import { replyWindowClosesAt } from "../../conversation/reply-window.js";
import { collectedOf } from "../../engine/turn.js";
import { badRequest } from "../../lib/http-error.js";
import type { Db } from "../../lib/prisma.js";

export const STAGE_FILTERS = [
  "all",
  "qualifying",
  "to_contact",
  "contacted",
  "not_interested",
] as const;
export const BOT_FILTERS = ["all", "active", "paused", "needs_human"] as const;
export const ASSIGNEE_FILTERS = ["all", "me", "none"] as const;

export type StageFilter = (typeof STAGE_FILTERS)[number];
export type BotFilter = (typeof BOT_FILTERS)[number];
export type AssigneeFilter = (typeof ASSIGNEE_FILTERS)[number];
export type BotActivity = Exclude<BotFilter, "all">;

/** Every thread view sends the assignee, so every thread read includes it. */
export const threadInclude = {
  assignedTo: { select: { id: true, email: true, archivedAt: true } },
} satisfies Prisma.ThreadInclude;

export type ThreadRow = Prisma.ThreadGetPayload<{
  include: typeof threadInclude;
}>;

export function stageWhere(stage: StageFilter): Prisma.ThreadWhereInput {
  return stage === "all" ? {} : { stage };
}

/** One activity per thread, needsHuman first, so the bot filters partition the threads. */
export function botWhere(bot: BotFilter): Prisma.ThreadWhereInput {
  switch (bot) {
    case "all":
      return {};
    case "needs_human":
      return { needsHuman: true };
    case "paused":
      return { paused: true, needsHuman: false };
    case "active":
      return { paused: false, needsHuman: false };
  }
}

/** "me" needs an operator row in the company; a platform admin in support access has none. */
export function assigneeWhere(
  assignee: AssigneeFilter,
  operatorId: string | null,
): Prisma.ThreadWhereInput {
  if (assignee === "all") return {};
  if (assignee === "none") return { assignedToId: null };
  if (!operatorId)
    throw badRequest(
      "Entraste como administrador: no tenés conversaciones asignadas en esta empresa.",
      "no_operator",
    );
  return { assignedToId: operatorId };
}

function botActivity(thread: ThreadRow): BotActivity {
  if (thread.needsHuman) return "needs_human";
  if (thread.paused) return "paused";
  return "active";
}

/** The lead wrote after reaching Por contactar, or after being marked Contactado. */
function wroteAgain(thread: ThreadRow): boolean {
  const since =
    thread.stage === "to_contact"
      ? thread.handedOffAt
      : thread.stage === "contacted"
        ? thread.contactedAt
        : null;
  return Boolean(since && thread.lastInboundAt && thread.lastInboundAt > since);
}

export type CrmStatus = "none" | "pending" | "synced" | "failed";

function crmStatus(thread: ThreadRow): CrmStatus {
  if (thread.crmPendingAction)
    return thread.crmLastError ? "failed" : "pending";
  return thread.crmSyncedAt ? "synced" : "none";
}

export function toThreadDto(thread: ThreadRow) {
  return {
    id: thread.id,
    phone: thread.phone,
    name: thread.name,
    email: thread.email,
    source: thread.source,
    state: thread.state,
    stage: thread.stage,
    botActivity: botActivity(thread),
    paused: thread.paused,
    pausedAt: thread.pausedAt,
    needsHuman: thread.needsHuman,
    needsHumanReason: thread.needsHumanReason,
    handedOffAt: thread.handedOffAt,
    wroteAgain: wroteAgain(thread),
    assignee: thread.assignedTo
      ? {
          id: thread.assignedTo.id,
          email: thread.assignedTo.email,
          archived: thread.assignedTo.archivedAt !== null,
        }
      : null,
    assignedAt: thread.assignedAt,
    contactedAt: thread.contactedAt,
    contactedBy: thread.contactedByEmail,
    /** The last stage change; `by` is null when the assistant made it. */
    stageChange: thread.stageChangedAt
      ? { at: thread.stageChangedAt, by: thread.stageChangedByEmail }
      : null,
    /** By collect item key. The thread view also sends them labeled, in config order (`fields`). */
    collected: collectedOf(thread.collected),
    summary: thread.summary,
    callTime: thread.callTime,
    lastInboundAt: thread.lastInboundAt,
    lastMessageAt: thread.lastMessageAt,
    lastMessagePreview: thread.lastMessagePreview,
    replyWindowClosesAt: replyWindowClosesAt(thread.lastInboundAt),
    crm: {
      status: crmStatus(thread),
      contactId: thread.crmContactId,
      syncedAt: thread.crmSyncedAt,
      lastError: thread.crmLastError,
      retriesExhausted:
        thread.crmPendingAction !== null &&
        thread.crmAttempts >= MAX_CRM_ATTEMPTS,
    },
    createdAt: thread.createdAt,
  };
}

export type ThreadDto = ReturnType<typeof toThreadDto>;

/** Reads one thread of the company for a response. */
export async function findThreadDto(db: Db, threadId: string) {
  return toThreadDto(
    await db.thread.findUniqueOrThrow({
      where: { id: threadId },
      include: threadInclude,
    }),
  );
}
