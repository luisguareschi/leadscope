import { Channel, FakeChannel, SendTemplateInput, SendTextInput } from "../channel";

const GRAPH_VERSION = "v21.0";

export class WhatsAppChannel implements Channel {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async sendText(input: SendTextInput): Promise<{ messageId: string | null }> {
    return this.post(input.phoneNumberId, input.accessToken, {
      messaging_product: "whatsapp",
      to: input.to.replace(/^\+/, ""),
      type: "text",
      text: { body: input.body },
    });
  }

  async sendTemplate(input: SendTemplateInput): Promise<{ messageId: string | null }> {
    return this.post(input.phoneNumberId, input.accessToken, {
      messaging_product: "whatsapp",
      to: input.to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.language },
      },
    });
  }

  private async post(
    phoneNumberId: string,
    accessToken: string,
    body: unknown,
  ): Promise<{ messageId: string | null }> {
    const response = await this.fetchImpl(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      throw new Error(`whatsapp send failed (${response.status})`);
    }
    const json = (await response.json()) as { messages?: { id?: string }[] };
    return { messageId: json.messages?.[0]?.id ?? null };
  }
}

/** One process-wide channel. A company token of "fake" or blank stays on the in-memory sender. */
export class RoutingChannel implements Channel {
  readonly fake = new FakeChannel();
  private readonly real = new WhatsAppChannel();

  async sendText(input: SendTextInput): Promise<{ messageId: string | null }> {
    if (!input.accessToken || input.accessToken === "fake") return this.fake.sendText(input);
    return this.real.sendText(input);
  }

  async sendTemplate(input: SendTemplateInput): Promise<{ messageId: string | null }> {
    if (!input.accessToken || input.accessToken === "fake") return this.fake.sendTemplate(input);
    return this.real.sendTemplate(input);
  }
}
