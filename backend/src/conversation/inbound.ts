import type { AppContext } from "../context.js";
import type { InboundMessage, StatusUpdate } from "../integrations/whatsapp/webhook-payload.js";
import { waIdToE164 } from "../lib/phone.js";
import { isUniqueViolation } from "../lib/prisma.js";

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
  | { status: "duplicate" | "unknown_company" | "invalid_phone" };

async function recordOnce(ctx: AppContext, message: InboundMessage): Promise<RecordResult> {
  const company = await ctx.db.company.findUnique({
    where: { whatsappPhoneNumberId: message.phoneNumberId },
    select: { id: true },
  });
  if (!company) return { status: "unknown_company" };
  const phone = waIdToE164(message.from);
  if (!phone) return { status: "invalid_phone" };

  const preview = messagePreview(message.type, message.body);
  return ctx.db.$transaction(async (tx) => {
    const thread = await tx.thread.upsert({
      where: { companyId_phone: { companyId: company.id, phone } },
      create: {
        companyId: company.id,
        phone,
        waId: message.from,
        name: message.profileName,
        lastInboundAt: message.sentAt,
        lastMessageAt: message.sentAt,
        lastMessagePreview: preview,
      },
      update: {
        waId: message.from,
        ...(message.profileName ? { name: message.profileName } : {}),
        lastInboundAt: message.sentAt,
        lastMessageAt: message.sentAt,
        lastMessagePreview: preview,
      },
      select: { id: true, paused: true, needsHuman: true },
    });
    // While a person handles the thread, the bot treats new messages as already seen.
    const botSilent = thread.paused || thread.needsHuman;
    await tx.message.create({
      data: {
        companyId: company.id,
        threadId: thread.id,
        direction: "inbound",
        type: message.type,
        body: message.body,
        waMessageId: message.waMessageId,
        sentAt: message.sentAt,
        handledAt: botSilent ? ctx.now() : null,
      },
    });
    return { status: "recorded" as const, threadId: thread.id, needsReply: !botSilent };
  });
}

/** Stores one inbound WhatsApp message. Safe to call twice with the same Meta delivery. */
export async function recordInboundMessage(ctx: AppContext, message: InboundMessage): Promise<RecordResult> {
  try {
    return await recordOnce(ctx, message);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const existing = await ctx.db.message.findUnique({ where: { waMessageId: message.waMessageId } });
    if (existing) return { status: "duplicate" };
    // Two first messages from the same new lead raced on the thread insert. The thread exists now.
    return recordOnce(ctx, message);
  }
}

const STATUS_RANK = ["sent", "delivered", "read"];

/** Applies a Meta delivery receipt without moving a status backwards (receipts can arrive out of order). */
export async function applyStatusUpdate(ctx: AppContext, update: StatusUpdate): Promise<void> {
  const rank = STATUS_RANK.indexOf(update.status);
  if (update.status !== "failed" && rank === -1) return;
  const lower = rank === -1 ? undefined : STATUS_RANK.slice(0, rank);
  await ctx.db.message.updateMany({
    where: {
      waMessageId: update.waMessageId,
      ...(lower ? { OR: [{ status: null }, { status: { in: lower } }] } : {}),
    },
    data: { status: update.status },
  });
}
