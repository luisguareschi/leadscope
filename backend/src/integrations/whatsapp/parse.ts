export type ParsedInbound = {
  phoneNumberId: string;
  from: string;
  messageId: string;
  contentType: string;
  text: string | null;
};

type WebhookMessage = {
  from?: string;
  id?: string;
  type?: string;
  text?: { body?: string };
};

type WebhookPayload = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: WebhookMessage[];
      };
    }[];
  }[];
};

export function parseInbound(payload: unknown): ParsedInbound[] {
  const body = payload as WebhookPayload;
  const found: ParsedInbound[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;
      for (const message of change.value?.messages ?? []) {
        if (!message.id || !message.from || !message.type) continue;
        found.push({
          phoneNumberId,
          from: message.from,
          messageId: message.id,
          contentType: message.type,
          text: message.type === "text" ? (message.text?.body ?? "") : null,
        });
      }
    }
  }
  return found;
}
