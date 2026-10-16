/**
 * Posts a signed Kapso v2 webhook to a running backend, as if a lead wrote on WhatsApp:
 *   npm run webhook:send -- "Hola, busco un 2 dormitorios" [--company altamira] [--from 59899000999]
 *        [--name Ana] [--url http://localhost:3001] [--type audio] [--batch]
 *        [--secret <webhook secret>] [--phone-number-id <id>]
 * It signs with the company's stored Kapso webhook secret (the seed sets `dev-kapso-webhook-secret`)
 * unless --secret is given, and uses the company's phone number id unless --phone-number-id is.
 * The reply arrives after the debounce (REPLY_DEBOUNCE_MS) and shows up in the backoffice.
 */
import { randomUUID } from "node:crypto";
import { parseArgs } from "node:util";
import { decryptSecrets } from "../src/companies/company-secrets.js";
import { loadEnv } from "../src/config/env.js";
import { signKapsoWebhook } from "../src/integrations/whatsapp/kapso/kapso-signature.js";
import { MESSAGE_RECEIVED } from "../src/integrations/whatsapp/kapso/kapso-webhook.js";
import { kapsoWebhookPath } from "../src/integrations/whatsapp/kapso/kapso-webhook-path.js";
import { parseEncryptionKey } from "../src/lib/crypto.js";
import { createPrisma } from "../src/lib/prisma.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    company: { type: "string", default: "altamira" },
    from: { type: "string", default: "59899000999" },
    name: { type: "string", default: "Lead de prueba" },
    url: { type: "string", default: "http://localhost:3001" },
    type: { type: "string", default: "text" },
    secret: { type: "string" },
    "phone-number-id": { type: "string" },
    batch: { type: "boolean", default: false },
  },
});

async function companyDefaults(slug: string) {
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  try {
    const company = await db.company.findUnique({ where: { slug } });
    if (!company) throw new Error(`No company with slug "${slug}"`);
    const secrets = decryptSecrets(
      company.encryptedSecrets,
      parseEncryptionKey(env.SECRETS_ENCRYPTION_KEY),
    );
    return {
      secret: secrets.kapsoWebhookSecret,
      phoneNumberId: company.whatsappPhoneNumberId,
    };
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const needsDb = !values.secret || !values["phone-number-id"];
  const stored = needsDb ? await companyDefaults(values.company) : null;
  const secret = values.secret ?? stored?.secret;
  const phoneNumberId = values["phone-number-id"] ?? stored?.phoneNumberId;
  if (!secret)
    throw new Error(
      "The company has no Kapso webhook secret. Pass --secret or set kapsoWebhookSecret.",
    );
  if (!phoneNumberId)
    throw new Error(
      "The company has no phone number id. Pass --phone-number-id or set it in Configuración.",
    );

  const text = positionals.join(" ") || "Hola, quiero información";
  const content =
    values.type === "text"
      ? { type: "text", text: { body: text } }
      : { type: values.type, [values.type]: { id: "media-id" } };
  const messageId = `wamid.local.${Date.now()}`;
  const event = {
    message: {
      id: messageId,
      timestamp: String(Math.floor(Date.now() / 1000)),
      from: values.from,
      ...content,
      kapso: {
        direction: "inbound",
        status: "received",
        processing_status: "pending",
        origin: "cloud_api",
        has_media: values.type !== "text",
      },
    },
    conversation: {
      id: `conv_local_${values.from}`,
      contact_name: values.name,
      phone_number: values.from,
      status: "active",
      phone_number_id: phoneNumberId,
    },
    is_new_conversation: false,
    phone_number_id: phoneNumberId,
  };
  const body = JSON.stringify(
    values.batch
      ? {
          type: MESSAGE_RECEIVED,
          batch: true,
          data: [event],
          batch_info: { size: 1, window_ms: 5000 },
        }
      : event,
  );
  const response = await fetch(
    `${values.url}${kapsoWebhookPath(values.company)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Event": MESSAGE_RECEIVED,
        "X-Webhook-Signature": signKapsoWebhook(body, secret),
        "X-Idempotency-Key": randomUUID(),
        "X-Webhook-Payload-Version": "v2",
        ...(values.batch
          ? { "X-Webhook-Batch": "true", "X-Batch-Size": "1" }
          : {}),
      },
      body,
    },
  );
  console.log(response.status, await response.text());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
