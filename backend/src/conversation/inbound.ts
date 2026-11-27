import { decryptSecrets } from "../companies/company-secrets.js";
import type { AppContext } from "../context.js";
import {
  downloadKapsoMedia,
  normalizeVisionMimeType,
} from "../integrations/whatsapp/kapso/kapso-channel.js";
import type {
  InboundMessage,
  StatusUpdate,
} from "../integrations/whatsapp/messages.js";
import { waIdToE164 } from "../lib/phone.js";
import { isUniqueViolation } from "../lib/prisma.js";
import { crmRequest } from "./crm-sync.js";

const PREVIEW_LABELS: Record<string, string> = {
  audio: "Audio",
  image: "Imagen",
  video: "Video",
  sticker: "Sticker",
  document: "Documento",
  location: "Ubicación",
  contacts: "Contacto",
  template: "Plantilla",
};

export function messagePreview(type: string, body: string): string {
  const text = body.replace(/\s+/g, " ").trim();
  const label = type === "text" ? null : (PREVIEW_LABELS[type] ?? "Mensaje");
  const preview = label ? `[${label}]${text ? ` ${text}` : ""}` : text;
  return preview.length > 140 ? `${preview.slice(0, 139)}…` : preview;
}

export type RecordResult =
  | { status: "recorded"; threadId: string; needsReply: boolean }
  | {
      status:
        "duplicate" | "unknown_company" | "archived_company" | "invalid_phone";
    };

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

async function storeInboundImage(
  ctx: AppContext,
  company: { id: string; encryptedSecrets: string | null },
  message: InboundMessage,
): Promise<{
  mediaPath: string;
  mediaMimeType: string;
  mediaFileName: string;
} | null> {
  if (message.type !== "image") return null;
  if (!message.mediaUrl && !message.mediaId) return null;
  const apiKey = decryptSecrets(
    company.encryptedSecrets,
    ctx.encryptionKey,
  ).kapsoApiKey;
  if (!apiKey && !message.mediaUrl) return null;
  try {
    const downloaded = await downloadKapsoMedia({
      apiKey: apiKey ?? "",
      mediaUrl: message.mediaUrl,
      mediaId: message.mediaId,
      fetchImpl: ctx.integrations.kapsoFetch,
    });
    if (!downloaded) return null;
    const mimeType =
      normalizeVisionMimeType(downloaded.mimeType) ??
      normalizeVisionMimeType(message.mediaMimeType);
    if (!mimeType) return null;
    const ext = extensionForMime(mimeType);
    const safeId = message.waMessageId.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = message.mediaFileName?.trim() || `imagen.${ext}`;
    const mediaPath = `${company.id}/messages/inbound-${safeId}.${ext}`;
    await ctx.storage.upload(mediaPath, downloaded.data, mimeType);
    return { mediaPath, mediaMimeType: mimeType, mediaFileName: fileName };
  } catch (error) {
    ctx.logger.warn(
      { err: error, companyId: company.id, waMessageId: message.waMessageId },
      "failed to download or store inbound image; continuing without vision",
    );
    return null;
  }
}

async function recordOnce(
  ctx: AppContext,
  message: InboundMessage,
): Promise<RecordResult> {
  const company = await ctx.db.company.findUnique({
    where: { whatsappPhoneNumberId: message.phoneNumberId },
    select: {
      id: true,
      archivedAt: true,
      hubspotEnabled: true,
      assistantPaused: true,
      encryptedSecrets: true,
    },
  });
  if (!company) return { status: "unknown_company" };
  // Archived: the number is ignored, as if it belonged to no company. Nothing is stored.
  if (company.archivedAt) return { status: "archived_company" };
  const phone = message.from ? waIdToE164(message.from) : null;
  const waId = phone ? message.from : null;
  const bsuid = message.bsuid?.trim() || null;
  const username = message.username?.trim().replace(/^@+/, "") || null;
  if (!phone && !bsuid) return { status: "invalid_phone" };

  // Avoid duplicate downloads if Meta/Kapso redelivered the same message.
  const duplicate = await ctx.db.message.findUnique({
    where: { waMessageId: message.waMessageId },
    select: { id: true },
  });
  if (duplicate) return { status: "duplicate" };

  const storedImage = await storeInboundImage(ctx, company, message);
  const preview = messagePreview(
    message.type,
    message.body || storedImage?.mediaFileName || "",
  );
  const threadSelect = {
    id: true,
    phone: true,
    waId: true,
    bsuid: true,
    paused: true,
    needsHuman: true,
    crmSyncedAt: true,
    crmPendingAction: true,
  } as const;
  const recorded = await ctx.db.$transaction(async (tx) => {
    // Match by BSUID first, then by phone (Kapso/Meta recommendation). Reconcile missing
    // identifiers when a lead sends both, without colliding with another existing thread.
    const byBsuid = bsuid
      ? await tx.thread.findUnique({
          where: { companyId_bsuid: { companyId: company.id, bsuid } },
          select: threadSelect,
        })
      : null;
    const byPhone = phone
      ? await tx.thread.findUnique({
          where: { companyId_phone: { companyId: company.id, phone } },
          select: threadSelect,
        })
      : null;

    const existing = byBsuid ?? byPhone;
    const thread = existing
      ? await tx.thread.update({
          where: { id: existing.id },
          data: {
            ...(phone &&
            !existing.phone &&
            (!byPhone || byPhone.id === existing.id)
              ? { phone }
              : {}),
            ...(waId &&
            (existing.phone === phone ||
              (!existing.phone && (!byPhone || byPhone.id === existing.id)))
              ? { waId }
              : {}),
            ...(bsuid &&
            !existing.bsuid &&
            (!byBsuid || byBsuid.id === existing.id)
              ? { bsuid }
              : {}),
            ...(username ? { username } : {}),
            ...(message.profileName ? { name: message.profileName } : {}),
            lastInboundAt: message.sentAt,
            lastMessageAt: message.sentAt,
            lastMessagePreview: preview,
            followUpCount: 0,
            lastFollowUpAt: null,
          },
          select: threadSelect,
        })
      : await tx.thread.create({
          data: {
            companyId: company.id,
            phone,
            waId,
            bsuid,
            username,
            name: message.profileName,
            lastInboundAt: message.sentAt,
            lastMessageAt: message.sentAt,
            lastMessagePreview: preview,
            followUpCount: 0,
            lastFollowUpAt: null,
          },
          select: threadSelect,
        });
    // Every lead goes to the CRM from their first message, even one who is disqualified later.
    // With HubSpot off nothing is queued; once it is on, a lead it never had is written on their
    // next message.
    const crmRequested =
      company.hubspotEnabled === true &&
      thread.crmSyncedAt === null &&
      thread.crmPendingAction === null;
    if (crmRequested) {
      await tx.thread.update({
        where: { id: thread.id },
        data: crmRequest("update"),
      });
    }
    // While the company assistant is paused or a person handles the thread, the bot treats new
    // messages as already seen so resuming does not trigger a burst of late replies.
    const botSilent =
      company.assistantPaused || thread.paused || thread.needsHuman;
    await tx.message.create({
      data: {
        companyId: company.id,
        threadId: thread.id,
        direction: "inbound",
        type: message.type,
        body: message.body,
        mediaPath: storedImage?.mediaPath ?? null,
        mediaMimeType:
          storedImage?.mediaMimeType ?? message.mediaMimeType ?? null,
        mediaFileName:
          storedImage?.mediaFileName ?? message.mediaFileName ?? null,
        waMessageId: message.waMessageId,
        sentAt: message.sentAt,
        handledAt: botSilent ? ctx.now() : null,
      },
    });
    return {
      result: {
        status: "recorded" as const,
        threadId: thread.id,
        needsReply: !botSilent,
      },
      crmRequested,
    };
  });
  // In the background, after the message is stored: the webhook's 200 never waits for HubSpot.
  if (recorded.crmRequested) ctx.crm.schedule(recorded.result.threadId);
  return recorded.result;
}

/** Stores one inbound WhatsApp message. Safe to call twice with the same delivery. */
export async function recordInboundMessage(
  ctx: AppContext,
  message: InboundMessage,
): Promise<RecordResult> {
  try {
    return await recordOnce(ctx, message);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await ctx.db.message.findUnique({
      where: { waMessageId: message.waMessageId },
    });
    if (existing) return { status: "duplicate" };
    // Two first messages from the same new lead raced on the thread insert. The thread exists now.
    return recordOnce(ctx, message);
  }
}

const STATUS_RANK = ["sent", "delivered", "read"];

/**
 * Applies a delivery receipt to one company's message without moving a status backwards
 * (receipts can arrive out of order).
 */
export async function applyStatusUpdate(
  ctx: AppContext,
  companyId: string,
  update: StatusUpdate,
): Promise<void> {
  const rank = STATUS_RANK.indexOf(update.status);
  if (update.status !== "failed" && rank === -1) return;
  const lower = rank === -1 ? undefined : STATUS_RANK.slice(0, rank);
  await ctx.db.message.updateMany({
    where: {
      companyId,
      waMessageId: update.waMessageId,
      ...(lower ? { OR: [{ status: null }, { status: { in: lower } }] } : {}),
    },
    data: { status: update.status },
  });
}
