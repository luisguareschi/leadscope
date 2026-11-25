import { parseCompanyConfig } from "../companies/company-config.js";
import type { AppContext } from "../context.js";
import { crmRequest, MAX_CRM_ATTEMPTS, syncWithCrmLease } from "./crm-sync.js";
import { runFollowUpTurn } from "./follow-up.js";
import { REPLY_WINDOW_MS } from "./reply-window.js";

const SWEEP_EVERY_MS = 30_000;
const HOUR_MS = 60 * 60 * 1000;
const FOLLOW_UP_WINDOW_MARGIN_MS = 30 * 60 * 1000;

/**
 * Transitions qualifying threads where the lead has stayed silent after the last outbound message
 * past the company's configured `inactivity.noResponseHours` threshold into `no_response`.
 */
export async function sweepNoResponse(ctx: AppContext): Promise<number> {
  const now = ctx.now();
  const companies = await ctx.db.company.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, config: true, hubspotEnabled: true },
  });
  let marked = 0;
  for (const company of companies) {
    const config = parseCompanyConfig(company.config, company.name);
    const hours = config.inactivity.noResponseHours;
    if (hours === null) continue;
    const cutoff = new Date(now.getTime() - hours * HOUR_MS);
    const candidates = await ctx.db.thread.findMany({
      where: {
        companyId: company.id,
        stage: "qualifying",
        paused: false,
        needsHuman: false,
        lastMessageAt: { lte: cutoff },
      },
      select: {
        id: true,
        lastInboundAt: true,
        lastMessageAt: true,
        stageChangedAt: true,
        messages: {
          orderBy: [{ createdAt: "desc" }, { sentAt: "desc" }],
          take: 1,
          select: { direction: true },
        },
      },
      take: 100,
    });
    for (const thread of candidates) {
      if (!thread.lastMessageAt) continue;
      // Only mark silent threads where the assistant/company spoke last (waiting on lead).
      if (thread.messages[0]?.direction !== "outbound") {
        continue;
      }
      const updated = await ctx.db.thread.updateMany({
        where: {
          id: thread.id,
          stage: "qualifying",
          stageChangedAt: thread.stageChangedAt,
          paused: false,
          needsHuman: false,
        },
        data: {
          stage: "no_response",
          state: "closed",
          stageChangedAt: now,
          stageChangedById: null,
          stageChangedByEmail: null,
          handedOffAt: null,
          ...(company.hubspotEnabled === true ? crmRequest("update") : {}),
        },
      });
      if (updated.count > 0) {
        marked += 1;
        if (company.hubspotEnabled === true) ctx.crm.schedule(thread.id);
      }
    }
  }
  return marked;
}

/**
 * Sends bot-generated contextual follow-ups within the 24-hour window for companies that enabled
 * `config.followUp.enabled`.
 */
export async function sweepFollowUps(ctx: AppContext): Promise<number> {
  const now = ctx.now();
  const companies = await ctx.db.company.findMany({
    where: { archivedAt: null, assistantPaused: false },
    select: { id: true, name: true, config: true },
  });
  let sent = 0;
  for (const company of companies) {
    const config = parseCompanyConfig(company.config, company.name);
    if (!config.followUp.enabled) continue;
    const delayCutoff = new Date(
      now.getTime() - config.followUp.delayHours * HOUR_MS,
    );
    const windowCutoff = new Date(
      now.getTime() - (REPLY_WINDOW_MS - FOLLOW_UP_WINDOW_MARGIN_MS),
    );
    const candidates = await ctx.db.thread.findMany({
      where: {
        companyId: company.id,
        stage: "qualifying",
        paused: false,
        needsHuman: false,
        followUpCount: { lt: config.followUp.maxCount },
        lastInboundAt: { gt: windowCutoff },
        lastMessageAt: { lte: delayCutoff },
      },
      select: {
        id: true,
        lastInboundAt: true,
        lastMessageAt: true,
        lastFollowUpAt: true,
        messages: {
          orderBy: [{ createdAt: "desc" }, { sentAt: "desc" }],
          take: 1,
          select: { direction: true },
        },
      },
      take: 25,
    });
    for (const thread of candidates) {
      if (ctx.replies.isBusy(thread.id)) continue;
      if (!thread.lastInboundAt || !thread.lastMessageAt) continue;
      if (thread.messages[0]?.direction !== "outbound") continue;
      const ref = thread.lastFollowUpAt ?? thread.lastMessageAt;
      if (ref > delayCutoff) continue;
      const outcome = await runFollowUpTurn(ctx, thread.id);
      if (outcome === "sent") sent += 1;
    }
  }
  return sent;
}

/**
 * Picks up work the in-memory scheduler does not know about: messages that arrived just before a
 * restart, turns a crashed process left behind, CRM writes that failed and are due again,
 * contextual follow-ups within 24 h, and inactive qualifying threads that become `no_response`.
 */
export async function sweepOnce(ctx: AppContext): Promise<{
  scheduled: number;
  crmRetried: number;
  followUpsSent: number;
  markedNoResponse: number;
}> {
  const now = ctx.now();
  const settledBefore = new Date(
    now.getTime() - ctx.env.REPLY_DEBOUNCE_MS - 5_000,
  );

  const unanswered = await ctx.db.message.findMany({
    where: {
      direction: "inbound",
      handledAt: null,
      createdAt: { lt: settledBefore },
      company: { assistantPaused: false, archivedAt: null },
    },
    select: { threadId: true },
    distinct: ["threadId"],
    take: 100,
  });
  let scheduled = 0;
  for (const { threadId } of unanswered) {
    if (ctx.replies.isBusy(threadId)) continue;
    ctx.replies.schedule(threadId);
    scheduled += 1;
  }

  const dueCrm = await ctx.db.thread.findMany({
    where: {
      crmPendingAction: { not: null },
      crmAttempts: { lt: MAX_CRM_ATTEMPTS },
      company: { hubspotEnabled: true },
      AND: [
        {
          OR: [{ crmNextAttemptAt: null }, { crmNextAttemptAt: { lte: now } }],
        },
        // A lease left by a crashed process expires; a live one means a write is running right now.
        { OR: [{ crmLeaseUntil: null }, { crmLeaseUntil: { lt: now } }] },
      ],
    },
    select: { id: true },
    take: 50,
  });
  for (const { id } of dueCrm) {
    if (ctx.crm.isBusy(id)) continue;
    await syncWithCrmLease(ctx, id);
  }

  const followUpsSent = await sweepFollowUps(ctx);
  const markedNoResponse = await sweepNoResponse(ctx);
  return {
    scheduled,
    crmRetried: dueCrm.length,
    followUpsSent,
    markedNoResponse,
  };
}

export function startSweeper(ctx: AppContext): () => void {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await sweepOnce(ctx);
    } catch (error) {
      ctx.logger.error({ err: error }, "sweep failed");
    } finally {
      running = false;
    }
  };
  void tick();
  const interval = setInterval(() => void tick(), SWEEP_EVERY_MS);
  return () => clearInterval(interval);
}
