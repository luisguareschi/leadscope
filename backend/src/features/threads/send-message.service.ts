import { loadCompany } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { messagePreview } from "../../conversation/inbound.js";
import { isWithinReplyWindow } from "../../conversation/reply-window.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { MissingIntegrationError } from "../../integrations/registry.js";
import { conflict, notFound } from "../../lib/http-error.js";
import { messageSelect, toMessageDto } from "./message-dto.js";
import { findThreadDto } from "./thread-dto.js";

/** WhatsApp's limit for a text message body. */
export const MAX_MANUAL_MESSAGE_CHARS = 4096;

/**
 * A person writes to the lead from the thread view, through the company's WhatsApp number. Writing
 * takes the thread over: the assistant is paused (a "Requiere asesor" flag is cleared, so it reads
 * Pausado), and a thread nobody had is assigned to the sender. The stage never changes, and the
 * assistant only comes back with Reanudar asistente. A message WhatsApp refuses is stored as
 * failed with the reason. Free-form text only inside the 24-hour window; there are no templates.
 */
export async function sendManualMessage(
  ctx: AppContext,
  access: CompanyAccess,
  threadId: string,
  body: string,
) {
  const { companyId, operatorId, actorEmail, support } = access;
  const thread = await ctx.db.thread.findFirst({
    where: { id: threadId, companyId },
    include: { company: true },
  });
  if (!thread) throw notFound("Conversación no encontrada");
  const now = ctx.now();
  if (!isWithinReplyWindow(thread.lastInboundAt, now))
    throw conflict(
      "Pasaron más de 24 horas desde el último mensaje del lead. WhatsApp no deja escribirle un mensaje libre hasta que vuelva a escribir.",
      "reply_window_closed",
    );

  // Before sending, so a bot turn that is answering right now drops its reply instead of
  // sending it after this one.
  await ctx.db.$transaction([
    ctx.db.thread.update({
      where: { id: threadId },
      data: {
        paused: true,
        pausedAt: thread.paused ? thread.pausedAt : now,
        needsHuman: false,
        needsHumanReason: null,
      },
    }),
    ...(operatorId
      ? [
          ctx.db.thread.updateMany({
            where: { id: threadId, assignedToId: null },
            data: { assignedToId: operatorId, assignedAt: now },
          }),
        ]
      : []),
    ctx.db.message.updateMany({
      where: { threadId, direction: "inbound", handledAt: null },
      data: { handledAt: now },
    }),
  ]);

  let waMessageId: string | null = null;
  let error: string | null = null;
  try {
    const company = loadCompany(thread.company, ctx.encryptionKey);
    ({ waMessageId } = await ctx.integrations
      .channelFor(company)
      .sendText({ to: thread.waId, body }));
  } catch (cause) {
    error =
      cause instanceof MissingIntegrationError
        ? "WhatsApp no está configurado para esta empresa."
        : (cause instanceof Error ? cause.message : String(cause)).slice(
            0,
            500,
          );
    ctx.logger.error(
      { err: cause, threadId, companyId },
      "manual whatsapp send failed",
    );
  }

  const sentAt = ctx.now();
  const [message] = await ctx.db.$transaction([
    ctx.db.message.create({
      data: {
        companyId,
        threadId,
        direction: "outbound",
        type: "text",
        body,
        waMessageId,
        status: error ? "failed" : "sent",
        error,
        sentByEmail: actorEmail,
        sentById: operatorId,
        sentBySupport: support,
        sentAt,
      },
      select: messageSelect,
    }),
    ctx.db.thread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: sentAt,
        lastMessagePreview: messagePreview("text", body),
      },
    }),
  ]);
  return {
    thread: await findThreadDto(ctx.db, threadId),
    message: toMessageDto(message),
  };
}
