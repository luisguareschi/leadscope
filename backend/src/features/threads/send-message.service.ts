import { randomUUID } from "node:crypto";
import { loadCompany } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { messagePreview } from "../../conversation/inbound.js";
import { isWithinReplyWindow } from "../../conversation/reply-window.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { MissingIntegrationError } from "../../integrations/registry.js";
import { whatsappRecipientFor } from "../../integrations/whatsapp/channel.js";
import {
  badRequest,
  conflict,
  HttpError,
  notFound,
} from "../../lib/http-error.js";
import {
  validateManualAttachment,
  whatsappMediaKind,
  type UploadedFile,
} from "../knowledge/prepare-upload.js";
import { messageSelect, toMessageDto } from "./message-dto.js";
import { findThreadDto } from "./thread-dto.js";

/** WhatsApp's limit for a text message body. */
export const MAX_MANUAL_MESSAGE_CHARS = 4096;
/** WhatsApp's caption limit for media messages. */
export const MAX_MEDIA_CAPTION_CHARS = 1024;
/** Max manual attachment upload size (15 MB). */
export const MAX_MANUAL_MEDIA_BYTES = 15 * 1024 * 1024;

export type ManualMessageInput = {
  body?: string;
  file?: UploadedFile;
  knowledgeFileId?: string;
};

/**
 * A person writes to the lead from the thread view, through the company's WhatsApp number.
 * Supports plain text, a direct file upload (PDF/image/doc), or sending an existing public file
 * from Conocimiento. Sending pauses the assistant and assigns an unassigned thread to the sender.
 */
export async function sendManualMessage(
  ctx: AppContext,
  access: CompanyAccess,
  threadId: string,
  input: string | ManualMessageInput,
) {
  const normalized: ManualMessageInput =
    typeof input === "string" ? { body: input } : input;
  const caption = normalized.body?.trim() ?? "";
  const { file, knowledgeFileId } = normalized;
  if (!caption && !file && !knowledgeFileId) {
    throw badRequest("Escribe un mensaje o adjunta un archivo.");
  }
  if (file && knowledgeFileId) {
    throw badRequest(
      "Envía un archivo adjunto o un archivo de Conocimiento, no ambos.",
    );
  }
  if (file && file.size > MAX_MANUAL_MEDIA_BYTES) {
    throw new HttpError(
      413,
      "El archivo supera el máximo de 15 MB.",
      "file_too_large",
    );
  }
  const hasMedia = Boolean(file || knowledgeFileId);
  const maxChars = hasMedia
    ? MAX_MEDIA_CAPTION_CHARS
    : MAX_MANUAL_MESSAGE_CHARS;
  if (caption.length > maxChars) {
    throw badRequest(
      `WhatsApp acepta hasta ${maxChars} caracteres${hasMedia ? " en el texto del adjunto" : " por mensaje"}.`,
    );
  }

  const { companyId, operatorId, actorEmail, support } = access;
  const thread = await ctx.db.thread.findFirst({
    where: { id: threadId, companyId },
    include: { company: true },
  });
  if (!thread) throw notFound("Conversación no encontrada");
  const now = ctx.now();
  if (!isWithinReplyWindow(thread.lastInboundAt, now))
    throw conflict(
      "Han pasado más de 24 horas desde el último mensaje del lead. WhatsApp no permite enviar mensajes libres hasta que vuelva a escribir.",
      "reply_window_closed",
    );

  // Resolve media before taking over/sending so invalid file ids fail cleanly without side effects.
  let resolvedMedia: {
    kind: "image" | "document";
    data: Buffer;
    mimeType: string;
    fileName: string;
    storagePath: string;
  } | null = null;

  if (knowledgeFileId) {
    const kfile = await ctx.db.knowledgeFile.findFirst({
      where: { id: knowledgeFileId, companyId },
      select: {
        id: true,
        name: true,
        mimeType: true,
        visibility: true,
        storagePath: true,
      },
    });
    if (!kfile) throw notFound("Archivo de Conocimiento no encontrado.");
    if (kfile.visibility !== "public") {
      throw badRequest(
        "Solo los archivos públicos pueden enviarse a leads.",
        "file_not_public",
      );
    }
    if (!kfile.storagePath) {
      throw badRequest(
        "Este archivo no tiene el binario guardado. Reemplázalo en Conocimiento para poder enviarlo.",
        "missing_file_binary",
      );
    }
    const stored = await ctx.storage.download(kfile.storagePath);
    const mimeType = kfile.mimeType || stored.contentType;
    resolvedMedia = {
      kind: whatsappMediaKind(mimeType, stored.data.length),
      data: stored.data,
      mimeType,
      fileName: kfile.name,
      storagePath: kfile.storagePath,
    };
  } else if (file) {
    const validated = validateManualAttachment(file);
    const safeName =
      validated.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) ||
      "file";
    const storagePath = `${companyId}/messages/${randomUUID()}-${safeName}`;
    await ctx.storage.upload(storagePath, file.buffer, validated.mimeType);
    resolvedMedia = {
      kind: whatsappMediaKind(validated.mimeType, file.buffer.length),
      data: file.buffer,
      mimeType: validated.mimeType,
      fileName: validated.fileName,
      storagePath,
    };
  }

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
    const channel = ctx.integrations.channelFor(company);
    const target = whatsappRecipientFor(thread);
    if (resolvedMedia) {
      ({ waMessageId } = await channel.sendMedia({
        ...target,
        kind: resolvedMedia.kind,
        data: resolvedMedia.data,
        mimeType: resolvedMedia.mimeType,
        fileName: resolvedMedia.fileName,
        caption: caption || undefined,
      }));
    } else {
      ({ waMessageId } = await channel.sendText({
        ...target,
        body: caption,
      }));
    }
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
  const messageType = resolvedMedia ? resolvedMedia.kind : "text";
  const previewText = caption || resolvedMedia?.fileName || "";
  const [message] = await ctx.db.$transaction([
    ctx.db.message.create({
      data: {
        companyId,
        threadId,
        direction: "outbound",
        type: messageType,
        body: caption,
        mediaPath: resolvedMedia?.storagePath ?? null,
        mediaMimeType: resolvedMedia?.mimeType ?? null,
        mediaFileName: resolvedMedia?.fileName ?? null,
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
        lastMessagePreview: messagePreview(messageType, previewText),
      },
    }),
  ]);
  return {
    thread: await findThreadDto(ctx.db, threadId),
    message: toMessageDto(message),
  };
}
