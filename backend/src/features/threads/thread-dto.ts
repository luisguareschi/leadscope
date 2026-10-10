import type { Prisma, Thread } from "../../generated/prisma/client.js";
import { MAX_CRM_ATTEMPTS } from "../../conversation/crm-sync.js";
import { replyWindowClosesAt } from "../../conversation/reply-window.js";

export type ThreadStatusFilter = "all" | "active" | "handoff" | "needs_human" | "paused" | "closed";

/**
 * The panel shows one status per thread, flags first: a thread waiting for a person is "needs_human"
 * whatever its stage. The filters partition the threads, so the counts add up to the total.
 */
export function statusWhere(status: ThreadStatusFilter): Prisma.ThreadWhereInput {
  switch (status) {
    case "all":
      return {};
    case "needs_human":
      return { needsHuman: true };
    case "paused":
      return { paused: true, needsHuman: false };
    case "handoff":
      return { state: "handoff", paused: false, needsHuman: false };
    case "closed":
      return { state: "closed", paused: false, needsHuman: false };
    case "active":
      return { state: { in: ["greeting", "qualify", "answer"] }, paused: false, needsHuman: false };
  }
}

export type CrmStatus = "none" | "pending" | "synced" | "failed";

function crmStatus(thread: Thread): CrmStatus {
  if (thread.crmPendingAction) return thread.crmLastError ? "failed" : "pending";
  return thread.crmSyncedAt ? "synced" : "none";
}

export function toThreadDto(thread: Thread) {
  return {
    id: thread.id,
    phone: thread.phone,
    name: thread.name,
    email: thread.email,
    source: thread.source,
    state: thread.state,
    paused: thread.paused,
    pausedAt: thread.pausedAt,
    needsHuman: thread.needsHuman,
    needsHumanReason: thread.needsHumanReason,
    interest: thread.interest,
    budget: thread.budget,
    knowsProjects: thread.knowsProjects,
    callTime: thread.callTime,
    lastMessageAt: thread.lastMessageAt,
    lastMessagePreview: thread.lastMessagePreview,
    replyWindowClosesAt: replyWindowClosesAt(thread.lastInboundAt),
    crm: {
      status: crmStatus(thread),
      contactId: thread.crmContactId,
      syncedAt: thread.crmSyncedAt,
      lastError: thread.crmLastError,
      retriesExhausted: thread.crmPendingAction !== null && thread.crmAttempts >= MAX_CRM_ATTEMPTS,
    },
    createdAt: thread.createdAt,
  };
}

export type ThreadDto = ReturnType<typeof toThreadDto>;
