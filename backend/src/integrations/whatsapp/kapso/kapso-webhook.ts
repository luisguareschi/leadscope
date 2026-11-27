import { z } from "zod";
import type { InboundMessage, StatusUpdate } from "../messages.js";

/**
 * Kapso v2 webhooks (https://docs.kapso.ai/docs/platform/webhooks/message-events). The event name
 * comes in `X-Webhook-Event`. With buffering on, the body is a batch envelope
 * `{ type, batch: true, data: [...] }` whose items have the unbuffered shape
 * (https://docs.kapso.ai/docs/platform/webhooks/advanced#batched-webhook-format).
 */
export const KAPSO_EVENT_HEADER = "x-webhook-event";
export const MESSAGE_RECEIVED = "whatsapp.message.received";
export const STATUS_EVENTS: Record<string, string> = {
  "whatsapp.message.sent": "sent",
  "whatsapp.message.delivered": "delivered",
  "whatsapp.message.read": "read",
  "whatsapp.message.failed": "failed",
};

const transcriptSchema = z
  .union([z.string(), z.object({ text: z.string().nullish() }).loose()])
  .nullish()
  .transform((value) => {
    if (typeof value === "string") return value.trim() || null;
    if (value && typeof value === "object" && typeof value.text === "string") {
      return value.text.trim() || null;
    }
    return null;
  });

const messageSchema = z
  .object({
    id: z.string(),
    timestamp: z.string().optional(),
    type: z.string(),
    from: z.string().nullish(),
    from_user_id: z.string().nullish(),
    text: z.object({ body: z.string() }).optional(),
    button: z.object({ text: z.string() }).optional(),
    interactive: z
      .object({
        button_reply: z.object({ title: z.string() }).optional(),
        list_reply: z.object({ title: z.string() }).optional(),
      })
      .optional(),
    audio: z
      .object({
        id: z.string().optional(),
        mime_type: z.string().optional(),
        voice: z.boolean().optional(),
      })
      .loose()
      .optional(),
    image: z
      .object({
        id: z.string().optional(),
        mime_type: z.string().optional(),
        caption: z.string().optional(),
      })
      .loose()
      .optional(),
    video: z
      .object({
        id: z.string().optional(),
        mime_type: z.string().optional(),
        caption: z.string().optional(),
      })
      .loose()
      .optional(),
    document: z
      .object({
        id: z.string().optional(),
        mime_type: z.string().optional(),
        filename: z.string().optional(),
        caption: z.string().optional(),
      })
      .loose()
      .optional(),
    kapso: z
      .object({
        direction: z.string().optional(),
        status: z.string().optional(),
        origin: z.string().optional(),
        passive: z.boolean().optional(),
        phone_number: z.string().nullish(),
        phone_number_id: z.string().nullish(),
        business_scoped_user_id: z.string().nullish(),
        username: z.string().nullish(),
        transcript: transcriptSchema,
        media_url: z.string().nullish(),
        media_data: z
          .object({
            url: z.string().nullish(),
            content_type: z.string().nullish(),
            filename: z.string().nullish(),
          })
          .loose()
          .nullish(),
      })
      .loose()
      .optional(),
  })
  .loose();

const eventSchema = z
  .object({
    message: z.unknown().optional(),
    conversation: z
      .object({
        contact_name: z.string().nullish(),
        phone_number: z.string().nullish(),
        phone_number_id: z.string().nullish(),
        business_scoped_user_id: z.string().nullish(),
        username: z.string().nullish(),
      })
      .loose()
      .optional(),
    phone_number_id: z.string().nullish(),
  })
  .loose();

const batchSchema = z
  .object({
    type: z.string().optional(),
    batch: z.literal(true),
    data: z.array(z.unknown()),
  })
  .loose();

/** Message types that never trigger a reply. */
const IGNORED_TYPES = new Set([
  "reaction",
  "system",
  "request_welcome",
  "ephemeral",
]);

/** Backfilled history and messages another app on a shared number handles are not the bot's to answer. */
const IGNORED_ORIGINS = new Set(["history_sync", "other_app"]);

type KapsoMessage = z.infer<typeof messageSchema>;

function contentOf(message: KapsoMessage): {
  type: string;
  body: string;
  mediaUrl: string | null;
  mediaId: string | null;
  mediaMimeType: string | null;
  mediaFileName: string | null;
} {
  const mediaUrl =
    message.kapso?.media_url ?? message.kapso?.media_data?.url ?? null;
  const mediaFileName =
    message.document?.filename ?? message.kapso?.media_data?.filename ?? null;
  switch (message.type) {
    case "text":
      return {
        type: "text",
        body: message.text?.body ?? "",
        mediaUrl: null,
        mediaId: null,
        mediaMimeType: null,
        mediaFileName: null,
      };
    case "button":
      return {
        type: "text",
        body: message.button?.text ?? "",
        mediaUrl: null,
        mediaId: null,
        mediaMimeType: null,
        mediaFileName: null,
      };
    case "interactive":
      return {
        type: "text",
        body:
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title ??
          "",
        mediaUrl: null,
        mediaId: null,
        mediaMimeType: null,
        mediaFileName: null,
      };
    case "audio":
      return {
        type: "audio",
        body: message.kapso?.transcript ?? "",
        mediaUrl,
        mediaId: message.audio?.id ?? null,
        mediaMimeType:
          message.audio?.mime_type ??
          message.kapso?.media_data?.content_type ??
          null,
        mediaFileName,
      };
    case "image":
      return {
        type: "image",
        body: message.image?.caption ?? "",
        mediaUrl,
        mediaId: message.image?.id ?? null,
        mediaMimeType:
          message.image?.mime_type ??
          message.kapso?.media_data?.content_type ??
          null,
        mediaFileName,
      };
    case "video":
      return {
        type: "video",
        body: message.video?.caption ?? "",
        mediaUrl,
        mediaId: message.video?.id ?? null,
        mediaMimeType:
          message.video?.mime_type ??
          message.kapso?.media_data?.content_type ??
          null,
        mediaFileName,
      };
    case "document":
      return {
        type: "document",
        body: message.document?.caption ?? "",
        mediaUrl,
        mediaId: message.document?.id ?? null,
        mediaMimeType:
          message.document?.mime_type ??
          message.kapso?.media_data?.content_type ??
          null,
        mediaFileName,
      };
    default:
      return {
        type: message.type,
        body: "",
        mediaUrl,
        mediaId: null,
        mediaMimeType: message.kapso?.media_data?.content_type ?? null,
        mediaFileName,
      };
  }
}

const digitsOf = (value: string | null | undefined) =>
  value ? value.replace(/\D/g, "") : "";

const cleanText = (value: string | null | undefined): string | null =>
  value?.trim() || null;

const cleanUsername = (value: string | null | undefined): string | null =>
  value?.trim().replace(/^@+/, "") || null;

export type ParsedKapsoWebhook = {
  messages: InboundMessage[];
  statuses: StatusUpdate[];
  /** Inbound messages carrying neither a phone number nor a business-scoped user id. */
  withoutSender: number;
};

export function parseKapsoWebhook(
  eventHeader: string | undefined,
  payload: unknown,
): ParsedKapsoWebhook {
  const result: ParsedKapsoWebhook = {
    messages: [],
    statuses: [],
    withoutSender: 0,
  };
  const batch = batchSchema.safeParse(payload);
  const items = batch.success ? batch.data.data : [payload];
  const event = eventHeader || (batch.success ? batch.data.type : undefined);
  const statusFromEvent = event ? STATUS_EVENTS[event] : undefined;
  if (event !== MESSAGE_RECEIVED && !statusFromEvent) return result;

  for (const item of items) {
    const parsed = eventSchema.safeParse(item);
    if (!parsed.success) continue;
    const message = messageSchema.safeParse(parsed.data.message);
    if (!message.success) continue;
    const { conversation } = parsed.data;
    const kapso = message.data.kapso;
    const phoneNumberId =
      parsed.data.phone_number_id ??
      conversation?.phone_number_id ??
      kapso?.phone_number_id;
    if (!phoneNumberId) continue;

    if (statusFromEvent) {
      result.statuses.push({
        phoneNumberId,
        waMessageId: message.data.id,
        status: statusFromEvent,
      });
      continue;
    }

    if (kapso?.direction && kapso.direction !== "inbound") continue;
    if (kapso?.passive) continue;
    if (kapso?.origin && IGNORED_ORIGINS.has(kapso.origin)) continue;
    if (IGNORED_TYPES.has(message.data.type)) continue;
    const from =
      digitsOf(message.data.from) ||
      digitsOf(kapso?.phone_number) ||
      digitsOf(conversation?.phone_number) ||
      null;
    const bsuid =
      cleanText(message.data.from_user_id) ??
      cleanText(kapso?.business_scoped_user_id) ??
      cleanText(conversation?.business_scoped_user_id);
    const username =
      cleanUsername(conversation?.username) ?? cleanUsername(kapso?.username);
    if (!from && !bsuid) {
      result.withoutSender += 1;
      continue;
    }
    const { type, body, mediaUrl, mediaId, mediaMimeType, mediaFileName } =
      contentOf(message.data);
    const seconds = Number(message.data.timestamp);
    result.messages.push({
      phoneNumberId,
      waMessageId: message.data.id,
      from,
      ...(bsuid ? { bsuid } : {}),
      ...(username ? { username } : {}),
      profileName: conversation?.contact_name || null,
      type,
      body: body.trim(),
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(mediaId ? { mediaId } : {}),
      ...(mediaMimeType ? { mediaMimeType } : {}),
      ...(mediaFileName ? { mediaFileName } : {}),
      sentAt:
        Number.isFinite(seconds) && seconds > 0
          ? new Date(seconds * 1000)
          : new Date(),
    });
  }
  return result;
}
