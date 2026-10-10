/**
 * Posts a signed, Meta-shaped webhook to a running backend, as if a lead wrote on WhatsApp:
 *   npm run webhook:send -- "Hola, busco un 2 dormitorios" [--from 59899000999] [--name Ana]
 *                           [--url http://localhost:3001] [--phone-number-id DEV_PHONE_NUMBER_ID] [--type audio]
 * The reply arrives after the debounce (REPLY_DEBOUNCE_MS) and shows up in the backoffice.
 */
import { parseArgs } from "node:util";
import { loadEnv } from "../src/config/env.js";
import { signWebhookBody } from "../src/integrations/whatsapp/signature.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    from: { type: "string", default: "59899000999" },
    name: { type: "string", default: "Lead de prueba" },
    url: { type: "string", default: "http://localhost:3001" },
    "phone-number-id": { type: "string", default: "DEV_PHONE_NUMBER_ID" },
    type: { type: "string", default: "text" },
  },
});

async function main() {
  const env = loadEnv();
  const text = positionals.join(" ") || "Hola, quiero información";
  const message =
    values.type === "text"
      ? { type: "text", text: { body: text } }
      : { type: values.type, [values.type]: { id: "media-id" } };
  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "59800000000", phone_number_id: values["phone-number-id"] },
              contacts: [{ wa_id: values.from, profile: { name: values.name } }],
              messages: [
                {
                  from: values.from,
                  id: `wamid.local.${Date.now()}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  ...message,
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const response = await fetch(`${values.url}/webhooks/whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hub-Signature-256": signWebhookBody(body, env.META_APP_SECRET) },
    body,
  });
  console.log(response.status, await response.text());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
