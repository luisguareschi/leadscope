import type { Express } from "express";
import request from "supertest";
import { signKapsoWebhook } from "../../src/integrations/whatsapp/kapso/kapso-signature.js";
import { TEST_KAPSO_WEBHOOK_SECRET } from "./test-env.js";

let counter = 0;

/** A `whatsapp.message.received` body as Kapso documents it (v2, unbuffered). */
export function kapsoMessageReceived(options: {
  phoneNumberId: string;
  text?: string;
  from?: string;
  name?: string;
  id?: string;
  message?: Record<string, unknown>;
}) {
  counter += 1;
  const from = options.from ?? "59899111222";
  return {
    message: {
      id: options.id ?? `wamid.kapso.${Date.now()}.${counter}`,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: "text",
      from,
      text: { body: options.text ?? "Hola" },
      kapso: {
        direction: "inbound",
        status: "received",
        processing_status: "pending",
        origin: "cloud_api",
        has_media: false,
        content: options.text ?? "Hola",
      },
      ...options.message,
    },
    conversation: {
      id: `conv_${from}`,
      contact_name: options.name ?? "Ana",
      phone_number: from,
      status: "active",
      phone_number_id: options.phoneNumberId,
    },
    is_new_conversation: false,
    phone_number_id: options.phoneNumberId,
  };
}

/** A `whatsapp.message.<status>` body for one of our outbound messages. */
export function kapsoStatus(options: {
  phoneNumberId: string;
  waMessageId: string;
  status: string;
}) {
  return {
    message: {
      id: options.waMessageId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: "text",
      to: "59899111222",
      kapso: {
        direction: "outbound",
        status: options.status,
        origin: "cloud_api",
      },
    },
    conversation: {
      id: "conv_59899111222",
      phone_number: "59899111222",
      phone_number_id: options.phoneNumberId,
    },
    phone_number_id: options.phoneNumberId,
  };
}

export function postKapsoWebhook(
  app: Express,
  companySlug: string,
  payload: unknown,
  options: {
    event?: string;
    secret?: string;
    signature?: string;
  } = {},
) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signature =
    options.signature ??
    signKapsoWebhook(body, options.secret ?? TEST_KAPSO_WEBHOOK_SECRET);
  return request(app)
    .post(`/webhooks/kapso/${companySlug}`)
    .set({
      "Content-Type": "application/json",
      "X-Webhook-Event": options.event ?? "whatsapp.message.received",
      "X-Webhook-Signature": signature,
      "X-Idempotency-Key": `idem-${Date.now()}-${(counter += 1)}`,
      "X-Webhook-Payload-Version": "v2",
    })
    .send(body);
}
