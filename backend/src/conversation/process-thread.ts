import { loadCompany, type LoadedCompany } from "../companies/load-company.js";
import type { AppContext } from "../context.js";
import {
  buildChatTurns,
  type ChatTurn,
  type HistoryMessage,
  type ImageAttachment,
} from "../engine/history.js";
import {
  buildTurnContext,
  type KnowledgeDocument,
  type PromptThread,
  type SendableFile,
} from "../engine/prompt.js";
import { collectedOf, decideTurn } from "../engine/turn.js";
import type {
  Collected,
  CrmActionKind,
  TurnDecision,
  TurnInput,
} from "../engine/types.js";
import { whatsappMediaKind } from "../features/knowledge/prepare-upload.js";
import type { Thread } from "../generated/prisma/client.js";
import type { Channel } from "../integrations/whatsapp/channel.js";
import { normalizeVisionMimeType } from "../integrations/whatsapp/kapso/kapso-channel.js";
import type { LlmClient, LlmUsageRecord } from "../llm/types.js";
import { crmRequest } from "./crm-sync.js";
import { messagePreview } from "./inbound.js";
import { isWithinReplyWindow } from "./reply-window.js";
import { loadSystemPrompt } from "./system-prompt.js";
import { withThreadLease } from "./thread-lease.js";
import { rulesFor } from "./turn-rules.js";

export type TurnOutcome =
  | "replied"
  | "send_failed"
  | "no_pending"
  | "silenced"
  | "window_closed"
  | "company_archived"
  | "company_paused"
  | "busy";

const MAX_IMAGES_PER_TURN = 3;

/** Natural typing pause between consecutive WhatsApp bubbles in the same turn. */
export function interMessageDelayMs(nextBody: string): number {
  return Math.min(1_400, Math.max(500, 350 + nextBody.length * 8));
}

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

function modelFailure(
  ctx: AppContext,
  error: unknown,
  log: { threadId: string | null; companyId: string },
): ModelCall {
  const reason = error instanceof Error ? error.message : String(error);
  ctx.logger.error({ err: error, ...log }, "model call failed");
  return {
    input: { kind: "model_failure", reason: reason.slice(0, 200) },
    usage: null,
  };
}

export type ModelCall = { input: TurnInput; usage: LlmUsageRecord | null };

/**
 * One model call for a lead's turn: the turn context from the lead's state, then `complete()`. An
 * error from the model becomes a `model_failure` turn. WhatsApp, follow-ups, and the panel's test
 * chat (Probar asistente) all go through it, so they cannot drift apart.
 */
export async function callModel(
  ctx: AppContext,
  llm: LlmClient,
  company: LoadedCompany,
  turn: {
    thread: PromptThread;
    /** Null for the panel's test chat, which has no stored thread. */
    threadId: string | null;
    system: string;
    documents: KnowledgeDocument[];
    sendableFiles?: SendableFile[];
    messages: ChatTurn[];
    followUpHours?: number;
  },
): Promise<ModelCall> {
  const { config } = company;
  try {
    const result = await llm.complete({
      model: config.llm.model,
      temperature: config.llm.temperature,
      timeoutMs: config.llm.timeoutMs,
      system: turn.system,
      turnContext: buildTurnContext(
        turn.thread,
        config,
        company.name,
        ctx.now(),
        turn.followUpHours !== undefined
          ? { followUpHours: turn.followUpHours }
          : undefined,
      ),
      messages: turn.messages,
      scenario: {
        thread: turn.thread,
        config,
        companyName: company.name,
        documents: turn.documents,
        sendableFiles: turn.sendableFiles,
        followUp: turn.followUpHours !== undefined,
      },
    });
    return {
      input: { kind: "model", output: result.output },
      usage: result.usage,
    };
  } catch (error) {
    return modelFailure(ctx, error, {
      threadId: turn.threadId,
      companyId: company.id,
    });
  }
}

async function loadImageAttachment(
  ctx: AppContext,
  mediaPath: string,
  mediaMimeType: string | null,
): Promise<ImageAttachment | null> {
  try {
    const stored = await ctx.storage.download(mediaPath);
    const mediaType =
      normalizeVisionMimeType(mediaMimeType) ??
      normalizeVisionMimeType(stored.contentType);
    if (!mediaType) return null;
    return { mediaType, base64: stored.data.toString("base64") };
  } catch (error) {
    ctx.logger.warn(
      { err: error, mediaPath },
      "could not load stored inbound image for vision",
    );
    return null;
  }
}

async function askModel(
  ctx: AppContext,
  company: LoadedCompany,
  thread: Thread,
  pendingIds: Set<string>,
): Promise<ModelCall> {
  const { config } = company;
  try {
    // Inside the try: on WhatsApp a missing key is a model failure, so the bot stops and says so.
    const llm = ctx.integrations.llmFor(company);
    const [{ system, documents, sendableFiles }, recent] = await Promise.all([
      loadSystemPrompt(ctx, company),
      ctx.db.message.findMany({
        where: { threadId: thread.id },
        orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
        take: config.llm.historyLimit,
        select: {
          id: true,
          direction: true,
          type: true,
          body: true,
          sentByEmail: true,
          mediaPath: true,
          mediaMimeType: true,
          mediaFileName: true,
        },
      }),
    ]);

    const ordered = recent.reverse();
    let attachedImages = 0;
    const history: HistoryMessage[] = [];
    for (const msg of ordered) {
      let image: ImageAttachment | null = null;
      if (
        msg.direction === "inbound" &&
        msg.type === "image" &&
        msg.mediaPath &&
        pendingIds.has(msg.id) &&
        attachedImages < MAX_IMAGES_PER_TURN
      ) {
        image = await loadImageAttachment(
          ctx,
          msg.mediaPath,
          msg.mediaMimeType,
        );
        if (image) attachedImages += 1;
      }
      history.push({
        direction: msg.direction,
        type: msg.type,
        body: msg.body,
        sentByEmail: msg.sentByEmail,
        mediaFileName: msg.mediaFileName,
        image,
      });
    }

    return await callModel(ctx, llm, company, {
      thread,
      threadId: thread.id,
      system,
      documents,
      sendableFiles,
      messages: buildChatTurns(history, config.llm.historyLimit, thread.source),
    });
  } catch (error) {
    return modelFailure(ctx, error, {
      threadId: thread.id,
      companyId: company.id,
    });
  }
}

/** Sends public KnowledgeFiles requested by the model via `sendFileIds`. Internal files are never sent. */
async function sendPublicFiles(
  ctx: AppContext,
  company: LoadedCompany,
  thread: Thread,
  channel: Channel,
  fileIds: string[],
): Promise<void> {
  if (fileIds.length === 0) return;
  const rows = await ctx.db.knowledgeFile.findMany({
    where: {
      id: { in: fileIds },
      companyId: company.id,
      visibility: "public",
      storagePath: { not: null },
    },
    select: {
      id: true,
      name: true,
      mimeType: true,
      storagePath: true,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  for (const id of fileIds) {
    const file = byId.get(id);
    if (!file?.storagePath) continue;
    let kind: "image" | "document" = whatsappMediaKind(file.mimeType, 0);
    let waMessageId: string | null = null;
    let sendError: string | null = null;
    try {
      const stored = await ctx.storage.download(file.storagePath);
      const mimeType = file.mimeType || stored.contentType;
      kind = whatsappMediaKind(mimeType, stored.data.length);
      ({ waMessageId } = await channel.sendMedia({
        to: thread.waId,
        kind,
        data: stored.data,
        mimeType,
        fileName: file.name,
      }));
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error);
      ctx.logger.error(
        { err: error, threadId: thread.id, companyId: company.id, fileId: id },
        "failed to send public knowledge file",
      );
    }
    const sentAt = ctx.now();
    await ctx.db.$transaction([
      ctx.db.message.create({
        data: {
          companyId: company.id,
          threadId: thread.id,
          direction: "outbound",
          type: kind,
          body: "",
          mediaPath: file.storagePath,
          mediaMimeType: file.mimeType,
          mediaFileName: file.name,
          waMessageId,
          status: sendError ? "failed" : "sent",
          error: sendError?.slice(0, 500) ?? null,
          sentAt,
        },
      }),
      ctx.db.thread.update({
        where: { id: thread.id },
        data: {
          lastMessageAt: sentAt,
          lastMessagePreview: messagePreview(kind, file.name),
        },
      }),
    ]);
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
    select: {
      id: true,
      type: true,
      body: true,
      mediaPath: true,
      mediaMimeType: true,
      waMessageId: true,
      sentAt: true,
    },
  });
  if (pending.length === 0) return "no_pending";
  const pendingIds = pending.map((message) => message.id);
  const pendingIdSet = new Set(pendingIds);
  const markHandled = () =>
    ctx.db.message.updateMany({
      where: { id: { in: pendingIds } },
      data: { handledAt: ctx.now() },
    });

  if (thread.company.archivedAt) {
    await markHandled();
    return "company_archived";
  }
  if (thread.company.assistantPaused) {
    await markHandled();
    return "company_paused";
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
        ...(company.hubspot.enabled ? crmRequest("needs_human") : {}),
      },
    });
    if (company.hubspot.enabled) ctx.crm.schedule(threadId);
    return "send_failed";
  }
  const lastWaId = pending.at(-1)?.waMessageId;
  if (lastWaId) void channel.markReadWithTyping(lastWaId);

  const hasUnderstandableInput = pending.some(
    (message) =>
      message.body.trim().length > 0 ||
      (message.type === "image" &&
        Boolean(message.mediaPath) &&
        normalizeVisionMimeType(message.mediaMimeType) !== null),
  );
  const { input, usage } = hasUnderstandableInput
    ? await askModel(ctx, company, thread, pendingIdSet)
    : { input: { kind: "non_text" } as TurnInput, usage: null };
  const decision: TurnDecision = decideTurn(thread, input, rulesFor(company));

  // A person who paused the thread, paused the company assistant, or wrote to the lead while
  // the model was answering wins.
  const latest = await ctx.db.thread.findUnique({
    where: { id: threadId },
    select: { paused: true, company: { select: { assistantPaused: true } } },
  });
  if (!latest) {
    await markHandled();
    return "silenced";
  }
  if (latest.company.assistantPaused) {
    await markHandled();
    return "company_paused";
  }
  if (latest.paused) {
    await markHandled();
    return "silenced";
  }

  type AttemptedBubble = {
    body: string;
    waMessageId: string | null;
    status: "sent" | "failed";
    error: string | null;
    sentAt: Date;
  };
  const attempted: AttemptedBubble[] = [];
  let sendError: string | null = null;
  let interruptedByPause = false;
  let lastBubbleTimeMs = 0;

  for (const [index, body] of decision.replies.entries()) {
    if (index > 0) {
      await ctx.sleep(interMessageDelayMs(body));
      const midCheck = await ctx.db.thread.findUnique({
        where: { id: threadId },
        select: {
          paused: true,
          company: { select: { assistantPaused: true } },
        },
      });
      if (!midCheck || midCheck.paused || midCheck.company.assistantPaused) {
        interruptedByPause = true;
        break;
      }
    }

    let waMessageId: string | null = null;
    let bubbleError: string | null = null;
    try {
      ({ waMessageId } = await channel.sendText({
        to: thread.waId,
        body,
      }));
    } catch (error) {
      bubbleError = error instanceof Error ? error.message : String(error);
      ctx.logger.error(
        { err: error, threadId, companyId: company.id, bubbleIndex: index },
        "whatsapp send failed",
      );
    }

    // Keep timestamps strictly monotonic so `orderBy: { sentAt: "asc" }` preserves bubble order
    // even when a frozen clock returns the same instant.
    const nowMs = ctx.now().getTime();
    const sentAtMs =
      index > 0 && nowMs <= lastBubbleTimeMs ? lastBubbleTimeMs + 1 : nowMs;
    lastBubbleTimeMs = sentAtMs;
    attempted.push({
      body,
      waMessageId,
      status: bubbleError ? "failed" : "sent",
      error: bubbleError?.slice(0, 500) ?? null,
      sentAt: new Date(sentAtMs),
    });

    if (bubbleError) {
      sendError = bubbleError;
      break;
    }
  }

  const lastAttempt = attempted.at(-1)!;
  const sentAt = lastAttempt.sentAt;
  const needsHumanReason = sendError
    ? `send_failed: ${sendError.slice(0, 200)}`
    : decision.needsHuman?.reason;
  const crmAction: CrmActionKind | null = !company.hubspot.enabled
    ? null
    : (decision.crm ??
      (sendError ? "needs_human" : null) ??
      (crmChanged(thread, decision) ? "update" : null));
  // The queue counts from the lead message that qualified them; anything later is "wrote again".
  const handedOff =
    decision.stage === "to_contact" && thread.stage !== "to_contact";
  const qualifiedAt = pending.at(-1)?.sentAt ?? sentAt;

  await ctx.db.$transaction([
    ...attempted.map((bubble) =>
      ctx.db.message.create({
        data: {
          companyId: company.id,
          threadId,
          direction: "outbound",
          type: "text",
          body: bubble.body,
          waMessageId: bubble.waMessageId,
          status: bubble.status,
          error: bubble.error,
          sentAt: bubble.sentAt,
        },
      }),
    ),
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
        lastMessagePreview: messagePreview("text", lastAttempt.body),
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

  if (!sendError && !interruptedByPause && decision.sendFileIds.length > 0) {
    await sendPublicFiles(ctx, company, thread, channel, decision.sendFileIds);
  }

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
