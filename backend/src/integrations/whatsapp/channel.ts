import { randomUUID } from "node:crypto";

/**
 * Outbound WhatsApp for one company. Kapso is the provider that ships; another one plugs in by
 * implementing this type and its own webhook route.
 */
export type Channel = {
  readonly kind: "kapso" | "fake";
  sendText(input: {
    to: string;
    body: string;
  }): Promise<{ waMessageId: string }>;
  sendTemplate(input: {
    to: string;
    name: string;
    language: string;
  }): Promise<{ waMessageId: string }>;
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

export type SentFakeMessage = {
  to: string;
  kind: "text" | "template";
  body: string;
  waMessageId: string;
  at: Date;
};

/** Records sends in memory. Used in development and tests when a company has no Kapso API key. */
export class FakeChannel implements Channel {
  readonly kind = "fake" as const;
  readonly sent: SentFakeMessage[] = [];

  async sendText({ to, body }: { to: string; body: string }) {
    const waMessageId = `wamid.fake.${randomUUID()}`;
    this.sent.push({ to, kind: "text", body, waMessageId, at: new Date() });
    return { waMessageId };
  }

  async sendTemplate({
    to,
    name,
  }: {
    to: string;
    name: string;
    language: string;
  }) {
    const waMessageId = `wamid.fake.${randomUUID()}`;
    this.sent.push({
      to,
      kind: "template",
      body: name,
      waMessageId,
      at: new Date(),
    });
    return { waMessageId };
  }

  async markReadWithTyping() {}
}
