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

const messageSchema = z
  .object({
    id: z.string(),
    timestamp: z.string().optional(),
    type: z.string(),
    from: z.string().nullish(),
    text: z.object({ body: z.string() }).optional(),
    button: z.object({ text: z.string() }).optional(),
    interactive: z
      .object({
        button_reply: z.object({ title: z.string() }).optional(),
        list_reply: z.object({ title: z.string() }).optional(),
      })
      .optional(),
    image: z.object({ caption: z.string().optional() }).optional(),
    video: z.object({ caption: z.string().optional() }).optional(),
    document: z.object({ caption: z.string().optional() }).optional(),
    kapso: z
      .object({
        direction: z.string().optional(),
        status: z.string().optional(),
        origin: z.string().optional(),
        passive: z.boolean().optional(),
        phone_number: z.string().nullish(),
        phone_number_id: z.string().nullish(),
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

function textOf(message: KapsoMessage): { type: string; body: string } {
  switch (message.type) {
    case "text":
      return { type: "text", body: message.text?.body ?? "" };
    case "button":
      return { type: "text", body: message.button?.text ?? "" };
    case "interactive":
      return {
        type: "text",
        body:
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title ??
          "",
      };
    case "image":
      return { type: "image", body: message.image?.caption ?? "" };
    case "video":
      return { type: "video", body: message.video?.caption ?? "" };
    case "document":
      return { type: "document", body: message.document?.caption ?? "" };
    default:
      return { type: message.type, body: "" };
  }
}

const digitsOf = (value: string | null | undefined) =>
  value ? value.replace(/\D/g, "") : "";

export type ParsedKapsoWebhook = {
  messages: InboundMessage[];
  statuses: StatusUpdate[];
  /**
   * Inbound messages that carry only a business-scoped user id and no phone number
   * (https://docs.kapso.ai/docs/whatsapp/business-scoped-user-ids). Threads are keyed by phone,
   * so these are not stored yet.
   */
  withoutPhone: number;
};

export function parseKapsoWebhook(
  eventHeader: string | undefined,
  payload: unknown,
): ParsedKapsoWebhook {
  const result: ParsedKapsoWebhook = {
    messages: [],
    statuses: [],
    withoutPhone: 0,
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
    const from = digitsOf(
      message.data.from ?? kapso?.phone_number ?? conversation?.phone_number,
    );
    if (!from) {
      result.withoutPhone += 1;
      continue;
    }
    const { type, body } = textOf(message.data);
    const seconds = Number(message.data.timestamp);
    result.messages.push({
      phoneNumberId,
      waMessageId: message.data.id,
      from,
      profileName: conversation?.contact_name || null,
      type,
      body: body.trim(),
      sentAt:
        Number.isFinite(seconds) && seconds > 0
          ? new Date(seconds * 1000)
          : new Date(),
    });
  }
  return result;
}
