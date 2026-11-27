import { randomUUID } from "node:crypto";

/**
 * Outbound recipient on WhatsApp: a phone number (`to`, international digits without `+`) or a
 * Meta Business-Scoped User ID (`recipient`, e.g. `CO.1602439504987482`).
 */
export type WhatsAppRecipient =
  { to: string; recipient?: undefined } | { recipient: string; to?: undefined };

export type SendTextInput = WhatsAppRecipient & { body: string };

export type SendTemplateInput = WhatsAppRecipient & {
  name: string;
  language: string;
};

export type SendMediaInput = WhatsAppRecipient & {
  kind: "image" | "document";
  data: Buffer;
  mimeType: string;
  fileName: string;
  caption?: string;
};

/**
 * Outbound WhatsApp for one company. Kapso is the provider that ships; another one plugs in by
 * implementing this type and its own webhook route.
 */
export type Channel = {
  readonly kind: "kapso" | "fake";
  sendText(input: SendTextInput): Promise<{ waMessageId: string }>;
  sendTemplate(input: SendTemplateInput): Promise<{ waMessageId: string }>;
  sendMedia(input: SendMediaInput): Promise<{ waMessageId: string }>;
  /** Marks the lead's message as read and shows "typing…" while the reply is prepared. Best effort. */
  markReadWithTyping(waMessageId: string): Promise<void>;
};

export class ChannelError extends Error {
  constructor(
    message: string,
    /** Meta's numeric error code (e.g. 131047), or the provider's own string code. */
    readonly code?: number | string,
    readonly status?: number,
  ) {
    super(message);
  }
}

/** Picks `to` (phone) when available, otherwise `recipient` (BSUID). */
export function whatsappRecipientFor(thread: {
  waId: string | null;
  bsuid?: string | null;
}): WhatsAppRecipient {
  if (thread.waId) return { to: thread.waId };
  if (thread.bsuid) return { recipient: thread.bsuid };
  throw new ChannelError(
    "La conversación no tiene teléfono ni identificador de WhatsApp para responder.",
    "missing_recipient",
  );
}

export type SentFakeMessage = {
  /** Phone `to` (or BSUID when sent by `recipient`). */
  to: string;
  /** Set when sent to a BSUID via `recipient`. */
  recipient?: string;
  kind: "text" | "template" | "image" | "document";
  body: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  waMessageId: string;
  at: Date;
};

/** Records sends in memory. Used in development and tests when a company has no Kapso API key. */
export class FakeChannel implements Channel {
  readonly kind = "fake" as const;
  readonly sent: SentFakeMessage[] = [];

  async sendText(input: SendTextInput) {
    const waMessageId = `wamid.fake.${randomUUID()}`;
    this.sent.push({
      to: input.to ?? input.recipient,
      ...(input.recipient ? { recipient: input.recipient } : {}),
      kind: "text",
      body: input.body,
      waMessageId,
      at: new Date(),
    });
    return { waMessageId };
  }

  async sendTemplate(input: SendTemplateInput) {
    const waMessageId = `wamid.fake.${randomUUID()}`;
    this.sent.push({
      to: input.to ?? input.recipient,
      ...(input.recipient ? { recipient: input.recipient } : {}),
      kind: "template",
      body: input.name,
      waMessageId,
      at: new Date(),
    });
    return { waMessageId };
  }

  async sendMedia(input: SendMediaInput) {
    const waMessageId = `wamid.fake.${randomUUID()}`;
    this.sent.push({
      to: input.to ?? input.recipient,
      ...(input.recipient ? { recipient: input.recipient } : {}),
      kind: input.kind,
      body: input.caption ?? "",
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.data.length,
      waMessageId,
      at: new Date(),
    });
    return { waMessageId };
  }

  async markReadWithTyping() {}
}
