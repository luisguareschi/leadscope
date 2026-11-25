import { loadCompany } from "../companies/load-company.js";
import type { AppContext } from "../context.js";
import { capReply } from "../engine/guardrails.js";
import { buildChatTurns } from "../engine/history.js";
import type { Channel } from "../integrations/whatsapp/channel.js";
import { messagePreview } from "./inbound.js";
import { callModel } from "./process-thread.js";
import { REPLY_WINDOW_MS } from "./reply-window.js";
import { loadSystemPrompt } from "./system-prompt.js";
import { withThreadLease } from "./thread-lease.js";

/** Leave a 30-minute safety margin before WhatsApp's 24-hour window closes. */
const FOLLOW_UP_WINDOW_MARGIN_MS = 30 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export type FollowUpOutcome = "sent" | "skipped" | "failed" | "busy";

/**
 * Generates and sends one contextual bot follow-up within WhatsApp's 24-hour window for a
 * qualifying thread that has gone quiet after the assistant's last message.
 */
export async function runFollowUpTurn(
  ctx: AppContext,
  threadId: string,
): Promise<FollowUpOutcome> {
  const leased = await withThreadLease(
    ctx,
    threadId,
    async (): Promise<FollowUpOutcome> => {
      const thread = await ctx.db.thread.findUnique({
        where: { id: threadId },
        include: { company: true },
      });
      if (!thread) return "skipped";
      if (
        thread.company.archivedAt ||
        thread.company.assistantPaused ||
        thread.paused ||
        thread.needsHuman ||
        thread.stage !== "qualifying"
      ) {
        return "skipped";
      }
      const company = loadCompany(thread.company, ctx.encryptionKey);
      const { followUp } = company.config;
      if (!followUp.enabled || thread.followUpCount >= followUp.maxCount) {
        return "skipped";
      }
      const now = ctx.now();
      if (!thread.lastInboundAt || !thread.lastMessageAt) return "skipped";
      // Must still have enough time inside WhatsApp's 24-hour window.
      if (
        now.getTime() - thread.lastInboundAt.getTime() >=
        REPLY_WINDOW_MS - FOLLOW_UP_WINDOW_MARGIN_MS
      ) {
        return "skipped";
      }
      // Last message must be outbound (waiting on the lead) and older than delayHours.
      const lastMsg = await ctx.db.message.findFirst({
        where: { threadId },
        orderBy: [{ createdAt: "desc" }, { sentAt: "desc" }],
        select: { direction: true },
      });
      if (lastMsg?.direction !== "outbound") return "skipped";
      const referenceAt = thread.lastFollowUpAt ?? thread.lastMessageAt;
      const elapsedMs = now.getTime() - referenceAt.getTime();
      if (elapsedMs < followUp.delayHours * HOUR_MS) {
        return "skipped";
      }
      // Never follow up if an unhandled inbound message is already queued.
      const unhandled = await ctx.db.message.count({
        where: { threadId, direction: "inbound", handledAt: null },
      });
      if (unhandled > 0) return "skipped";

      let channel: Channel;
      try {
        channel = ctx.integrations.channelFor(company);
      } catch {
        return "skipped";
      }

      let llm;
      try {
        llm = ctx.integrations.llmFor(company);
      } catch {
        return "skipped";
      }

      const [{ system, documents }, recent] = await Promise.all([
        loadSystemPrompt(ctx, company),
        ctx.db.message.findMany({
          where: { threadId },
          orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
          take: company.config.llm.historyLimit,
          select: {
            direction: true,
            type: true,
            body: true,
            sentByEmail: true,
            mediaFileName: true,
          },
        }),
      ]);

      const { input, usage } = await callModel(ctx, llm, company, {
        thread,
        threadId,
        system,
        documents,
        messages: buildChatTurns(
          recent.reverse(),
          company.config.llm.historyLimit,
          thread.source,
        ),
        followUpHours: Math.max(1, Math.round(elapsedMs / HOUR_MS)),
      });
      if (input.kind !== "model") return "failed";
      if (input.output.forbiddenTopic || input.output.needsHuman) {
        return "skipped";
      }
      const reply = capReply(input.output.reply, company.config.maxReplyChars);
      if (!reply) return "failed";

      // Re-check before sending: a person pausing or the lead replying wins.
      const latest = await ctx.db.thread.findUnique({
        where: { id: threadId },
        select: {
          paused: true,
          needsHuman: true,
          stage: true,
          lastInboundAt: true,
          company: { select: { assistantPaused: true, archivedAt: true } },
        },
      });
      if (
        !latest ||
        latest.paused ||
        latest.needsHuman ||
        latest.stage !== "qualifying" ||
        latest.company.assistantPaused ||
        latest.company.archivedAt ||
        (latest.lastInboundAt &&
          latest.lastInboundAt.getTime() > thread.lastInboundAt.getTime())
      ) {
        return "skipped";
      }

      let waMessageId: string | null = null;
      let sendError: string | null = null;
      try {
        ({ waMessageId } = await channel.sendText({
          to: thread.waId,
          body: reply,
        }));
      } catch (error) {
        sendError = error instanceof Error ? error.message : String(error);
        ctx.logger.error(
          { err: error, threadId, companyId: company.id },
          "follow-up whatsapp send failed",
        );
      }

      const sentAt = ctx.now();
      await ctx.db.$transaction([
        ctx.db.message.create({
          data: {
            companyId: company.id,
            threadId,
            direction: "outbound",
            type: "text",
            body: reply,
            waMessageId,
            status: sendError ? "failed" : "sent",
            error: sendError?.slice(0, 500) ?? null,
            sentAt,
          },
        }),
        ctx.db.thread.update({
          where: { id: threadId },
          data: {
            followUpCount: { increment: 1 },
            lastFollowUpAt: sentAt,
            lastMessageAt: sentAt,
            lastMessagePreview: messagePreview("text", reply),
          },
        }),
        ...(usage
          ? [
              ctx.db.llmUsage.create({
                data: { companyId: company.id, threadId, ...usage },
              }),
            ]
          : []),
      ]);

      return sendError ? "failed" : "sent";
    },
  );
  return leased.claimed ? leased.result : "busy";
}
