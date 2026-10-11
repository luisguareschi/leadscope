import { z } from "zod";

export type InboundMessage = {
  phoneNumberId: string;
  waMessageId: string;
  /** The lead's WhatsApp id: international digits, no plus sign. */
  from: string;
  profileName: string | null;
  /** WhatsApp type. Quick-reply buttons and interactive replies count as text. */
  type: string;
  /** Message text, or the caption of an image, video, or document. Empty when there is none. */
  body: string;
  sentAt: Date;
};

export type StatusUpdate = {
  waMessageId: string;
  status: string;
};

const messageSchema = z
  .object({
    from: z.string(),
    id: z.string(),
    timestamp: z.string().optional(),
    type: z.string(),
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
  })
  .loose();

const valueSchema = z
  .object({
    metadata: z.object({ phone_number_id: z.string() }).loose(),
    contacts: z
      .array(z.object({ wa_id: z.string().optional(), profile: z.object({ name: z.string().optional() }).optional() }))
      .optional(),
    messages: z.array(z.unknown()).optional(),
    statuses: z.array(z.object({ id: z.string(), status: z.string() }).loose()).optional(),
  })
  .loose();

const payloadSchema = z
  .object({
    entry: z
      .array(
        z
          .object({ changes: z.array(z.object({ field: z.string().optional(), value: z.unknown() }).loose()).default([]) })
          .loose(),
      )
      .default([]),
  })
  .loose();

/** Message types that never trigger a reply. */
const IGNORED_TYPES = new Set(["reaction", "system", "request_welcome", "ephemeral"]);

function textOf(message: z.infer<typeof messageSchema>): { type: string; body: string } {
  switch (message.type) {
    case "text":
      return { type: "text", body: message.text?.body ?? "" };
    case "button":
      return { type: "text", body: message.button?.text ?? "" };
    case "interactive":
      return {
        type: "text",
        body: message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "",
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

export function parseWebhookPayload(payload: unknown): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { messages: [], statuses: [] };
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const value = valueSchema.safeParse(change.value);
      if (!value.success) continue;
      const phoneNumberId = value.data.metadata.phone_number_id;
      const names = new Map(
        (value.data.contacts ?? []).map((contact) => [contact.wa_id ?? "", contact.profile?.name ?? null]),
      );

      for (const raw of value.data.messages ?? []) {
        const message = messageSchema.safeParse(raw);
        if (!message.success || IGNORED_TYPES.has(message.data.type)) continue;
        const { type, body } = textOf(message.data);
        const seconds = Number(message.data.timestamp);
        messages.push({
          phoneNumberId,
          waMessageId: message.data.id,
          from: message.data.from,
          profileName: names.get(message.data.from) ?? null,
          type,
          body: body.trim(),
          sentAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date(),
        });
      }

      for (const status of value.data.statuses ?? []) {
        statuses.push({ waMessageId: status.id, status: status.status });
      }
    }
  }
  return { messages, statuses };
}
