import { randomUUID } from "node:crypto";

export type Channel = {
  readonly kind: "meta" | "fake";
  sendText(input: { to: string; body: string }): Promise<{ waMessageId: string }>;
  sendTemplate(input: { to: string; name: string; language: string }): Promise<{ waMessageId: string }>;
  /** Marks the lead's message as read and shows "typing…" while the reply is prepared. Best effort. */
  markReadWithTyping(waMessageId: string): Promise<void>;
};

export class ChannelError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }
}

type MetaChannelOptions = {
  phoneNumberId: string;
  accessToken: string;
  graphVersion: string;
  fetchImpl?: typeof fetch;
};

export function createMetaChannel(options: MetaChannelOptions): Channel {
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `https://graph.facebook.com/${options.graphVersion}/${options.phoneNumberId}/messages`;

  async function post(body: Record<string, unknown>): Promise<{ messages?: Array<{ id: string }> }> {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await response.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string; code?: number };
    };
    if (!response.ok) {
      throw new ChannelError(json.error?.message ?? `WhatsApp API returned ${response.status}`, json.error?.code);
    }
    return json;
  }

  function messageIdOf(json: { messages?: Array<{ id: string }> }): string {
    const id = json.messages?.[0]?.id;
    if (!id) throw new ChannelError("WhatsApp API response had no message id");
    return id;
  }

  return {
    kind: "meta",
    async sendText({ to, body }) {
      const json = await post({ recipient_type: "individual", to, type: "text", text: { preview_url: false, body } });
      return { waMessageId: messageIdOf(json) };
    },
    async sendTemplate({ to, name, language }) {
      const json = await post({ to, type: "template", template: { name, language: { code: language } } });
      return { waMessageId: messageIdOf(json) };
    },
    async markReadWithTyping(waMessageId) {
      await post({ status: "read", message_id: waMessageId, typing_indicator: { type: "text" } }).catch(() => undefined);
    },
  };
}

export type SentFakeMessage = { to: string; kind: "text" | "template"; body: string; waMessageId: string; at: Date };

/** Records sends in memory. Used in development and tests when a company has no Meta token. */
export class FakeChannel implements Channel {
  readonly kind = "fake" as const;
  readonly sent: SentFakeMessage[] = [];

  async sendText({ to, body }: { to: string; body: string }) {
    const waMessageId = `wamid.fake.${randomUUID()}`;
    this.sent.push({ to, kind: "text", body, waMessageId, at: new Date() });
    return { waMessageId };
  }

  async sendTemplate({ to, name }: { to: string; name: string; language: string }) {
    const waMessageId = `wamid.fake.${randomUUID()}`;
    this.sent.push({ to, kind: "template", body: name, waMessageId, at: new Date() });
    return { waMessageId };
  }

  async markReadWithTyping() {}
}
