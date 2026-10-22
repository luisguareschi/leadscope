import { loadCompany, type LoadedCompany } from "../companies/load-company.js";
import type { AppContext } from "../context.js";
import { buildChatTurns } from "../engine/history.js";
import { buildTurnContext } from "../engine/prompt.js";
import { collectedOf, decideTurn } from "../engine/turn.js";
import type {
  Collected,
  CrmActionKind,
  TurnDecision,
  TurnInput,
  TurnRules,
} from "../engine/types.js";
import type { Thread } from "../generated/prisma/client.js";
import type { Channel } from "../integrations/whatsapp/channel.js";
import type { LlmUsageRecord } from "../llm/types.js";
import { crmRequest } from "./crm-sync.js";
import { messagePreview } from "./inbound.js";
import { isWithinReplyWindow } from "./reply-window.js";
import { loadSystemPrompt } from "./system-prompt.js";
import { withThreadLease } from "./thread-lease.js";

export type TurnOutcome =
  | "replied"
  | "send_failed"
  | "no_pending"
  | "silenced"
  | "window_closed"
  | "company_archived"
  | "busy";

function sameCollected(a: Collected, b: Collected): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key] === b[key])
  );
}

/** HubSpot has never had this lead, or the turn changed what its property shows. */
function crmChanged(thread: Thread, decision: TurnDecision): boolean {
  if (thread.crmSyncedAt === null && thread.crmPendingAction === null)
    return true;
  return (
    !sameCollected(collectedOf(thread.collected), decision.fields.collected) ||
    thread.summary !== decision.summary ||
    thread.callTime !== decision.fields.callTime ||
    thread.stage !== decision.stage
  );
}

function rulesFor(company: LoadedCompany): TurnRules {
  return {
    maxReplyChars: company.config.maxReplyChars,
    collect: company.config.collect,
    messages: company.config.messages,
  };
}

async function askModel(
  ctx: AppContext,
  company: LoadedCompany,
  thread: Thread,
): Promise<{ input: TurnInput; usage: LlmUsageRecord | null }> {
  const { config } = company;
  try {
    const [{ system, documents }, recent] = await Promise.all([
      loadSystemPrompt(ctx, company),
      ctx.db.message.findMany({
        where: { threadId: thread.id },
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        take: config.llm.historyLimit,
        select: { direction: true, type: true, body: true },
      }),
    ]);
    const result = await ctx.integrations.llmFor(company).complete({
      model: config.llm.model,
      temperature: config.llm.temperature,
      timeoutMs: config.llm.timeoutMs,
      system,
      turnContext: buildTurnContext(thread, config, ctx.now()),
      messages: buildChatTurns(recent.reverse(), config.llm.historyLimit),
      scenario: { thread, config, documents },
    });
    return {
      input: { kind: "model", output: result.output },
      usage: result.usage,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    ctx.logger.error(
      { err: error, threadId: thread.id, companyId: company.id },
      "model call failed",
    );
    return {
      input: { kind: "model_failure", reason: reason.slice(0, 200) },
      usage: null,
    };
  }
}

async function runTurn(
  ctx: AppContext,
  threadId: string,
): Promise<TurnOutcome> {
  const thread = await ctx.db.thread.findUnique({
    where: { id: threadId },
    include: { company: true },
  });
  if (!thread) return "no_pending";
  const pending = await ctx.db.message.findMany({
    where: { threadId, direction: "inbound", handledAt: null },
    orderBy: { sentAt: "asc" },
    select: { id: true, body: true, waMessageId: true, sentAt: true },
  });
  if (pending.length === 0) return "no_pending";
  const pendingIds = pending.map((message) => message.id);
  const markHandled = () =>
    ctx.db.message.updateMany({
      where: { id: { in: pendingIds } },
      data: { handledAt: ctx.now() },
    });

  if (thread.company.archivedAt) {
    await markHandled();
    return "company_archived";
  }
  if (thread.paused || thread.needsHuman) {
    await markHandled();
    return "silenced";
  }
  if (!isWithinReplyWindow(thread.lastInboundAt, ctx.now())) {
    await markHandled();
    ctx.logger.warn(
      { threadId, companyId: thread.companyId },
      "reply window closed; not answering",
    );
    return "window_closed";
  }

  const company = loadCompany(thread.company, ctx.encryptionKey);
  let channel: Channel;
  try {
    channel = ctx.integrations.channelFor(company);
  } catch (error) {
    ctx.logger.error(
      { err: error, threadId, companyId: company.id },
      "whatsapp channel unavailable",
    );
    await markHandled();
    await ctx.db.thread.update({
      where: { id: threadId },
      data: {
        needsHuman: true,
        needsHumanReason: "channel_unavailable",
        ...crmRequest("needs_human"),
      },
    });
    ctx.crm.schedule(threadId);
    return "send_failed";
  }
  const lastWaId = pending.at(-1)?.waMessageId;
  if (lastWaId) void channel.markReadWithTyping(lastWaId);

  const hasText = pending.some((message) => message.body.trim().length > 0);
  const { input, usage } = hasText
    ? await askModel(ctx, company, thread)
    : { input: { kind: "non_text" } as TurnInput, usage: null };
  const decision: TurnDecision = decideTurn(thread, input, rulesFor(company));

  let waMessageId: string | null = null;
  let sendError: string | null = null;
  try {
    ({ waMessageId } = await channel.sendText({
      to: thread.waId,
      body: decision.reply,
    }));
  } catch (error) {
    sendError = error instanceof Error ? error.message : String(error);
    ctx.logger.error(
      { err: error, threadId, companyId: company.id },
      "whatsapp send failed",
    );
  }

  const needsHumanReason = sendError
    ? `send_failed: ${sendError.slice(0, 200)}`
    : decision.needsHuman?.reason;
  const crmAction: CrmActionKind | null =
    decision.crm ??
    (sendError ? "needs_human" : null) ??
    (crmChanged(thread, decision) ? "update" : null);
  const sentAt = ctx.now();
  // The queue counts from the lead message that qualified them; anything later is "wrote again".
  const handedOff =
    decision.stage === "to_contact" && thread.stage !== "to_contact";
  const qualifiedAt = pending.at(-1)?.sentAt ?? sentAt;

  await ctx.db.$transaction([
    ctx.db.message.create({
      data: {
        companyId: company.id,
        threadId,
        direction: "outbound",
        type: "text",
        body: decision.reply,
        waMessageId,
        status: sendError ? "failed" : "sent",
        sentAt,
      },
    }),
    ctx.db.message.updateMany({
      where: { id: { in: pendingIds } },
      data: { handledAt: sentAt },
    }),
    ctx.db.thread.update({
      where: { id: threadId },
      data: {
        collected: decision.fields.collected,
        callTime: decision.fields.callTime,
        summary: decision.summary,
        ...(needsHumanReason ? { needsHuman: true, needsHumanReason } : {}),
        lastMessageAt: sentAt,
        lastMessagePreview: messagePreview("text", decision.reply),
        ...(crmAction ? crmRequest(crmAction) : {}),
      },
    }),
    // Conditional, so a person who picked a stage during this turn keeps it, with the
    // conversation step that goes with it.
    ctx.db.thread.updateMany({
      where: {
        id: threadId,
        stage: thread.stage,
        stageChangedAt: thread.stageChangedAt,
      },
      data: {
        state: decision.state,
        ...(decision.stage !== thread.stage
          ? {
              stage: decision.stage,
              stageChangedAt: sentAt,
              stageChangedById: null,
              stageChangedByEmail: null,
              ...(handedOff ? { handedOffAt: qualifiedAt } : {}),
            }
          : {}),
      },
    }),
    // The lead has been greeted even when a person's change kept this turn's step from being saved.
    ...(thread.state === "greeting" && decision.state !== "greeting"
      ? [
          ctx.db.thread.updateMany({
            where: { id: threadId, state: "greeting" },
            data: { state: decision.state },
          }),
        ]
      : []),
    ...(usage
      ? [
          ctx.db.llmUsage.create({
            data: { companyId: company.id, threadId, ...usage },
          }),
        ]
      : []),
  ]);

  // In the background: the next turn of this thread must not wait for HubSpot either.
  if (crmAction) ctx.crm.schedule(threadId);
  return sendError ? "send_failed" : "replied";
}

/** One bot turn for a thread: answers every inbound message that has not been handled yet. */
export async function processThread(
  ctx: AppContext,
  threadId: string,
): Promise<TurnOutcome> {
  const leased = await withThreadLease(ctx, threadId, () =>
    runTurn(ctx, threadId),
  );
  return leased.claimed ? leased.result : "busy";
}
