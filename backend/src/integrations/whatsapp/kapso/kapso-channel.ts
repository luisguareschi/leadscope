import { ChannelError, type Channel } from "../channel.js";
import {
  KAPSO_WHATSAPP_API_VERSION,
  kapsoErrorOf,
  kapsoRequest,
  type KapsoClientOptions,
} from "./kapso-api.js";

type KapsoChannelOptions = KapsoClientOptions & {
  /** Meta's Phone number ID; Kapso uses the same id. */
  phoneNumberId: string;
};

/**
 * Sends through Kapso's WhatsApp API, which takes Meta's Cloud API body unchanged:
 * https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message
 */
export function createKapsoChannel(options: KapsoChannelOptions): Channel {
  const path = `/meta/whatsapp/${KAPSO_WHATSAPP_API_VERSION}/${encodeURIComponent(options.phoneNumberId)}/messages`;

  async function post(
    body: Record<string, unknown>,
  ): Promise<{ messages?: Array<{ id?: string }> }> {
    const response = await kapsoRequest(options, path, {
      method: "POST",
      body: { messaging_product: "whatsapp", ...body },
    });
    if (!response.ok) {
      const { message, code } = kapsoErrorOf(response);
      throw new ChannelError(message, code, response.status);
    }
    return response.json as { messages?: Array<{ id?: string }> };
  }

  function messageIdOf(json: { messages?: Array<{ id?: string }> }): string {
    const id = json.messages?.[0]?.id;
    if (!id) throw new ChannelError("Kapso response had no message id");
    return id;
  }

  return {
    kind: "kapso",
    async sendText({ to, body }) {
      const json = await post({
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      });
      return { waMessageId: messageIdOf(json) };
    },
    async sendTemplate({ to, name, language }) {
      const json = await post({
        recipient_type: "individual",
        to,
        type: "template",
        template: { name, language: { code: language } },
      });
      return { waMessageId: messageIdOf(json) };
    },
    // https://docs.kapso.ai/docs/whatsapp/send-messages/mark-read
    async markReadWithTyping(waMessageId) {
      await post({
        status: "read",
        message_id: waMessageId,
        typing_indicator: { type: "text" },
      }).catch(() => undefined);
    },
  };
}
