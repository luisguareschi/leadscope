import {
  encryptSecrets,
  decryptSecrets,
} from "../src/companies/company-secrets.js";
import {
  parseCompanyConfig,
  type CompanyConfig,
} from "../src/companies/company-config.js";
import { loadEnv } from "../src/config/env.js";
import { MAX_CRM_ATTEMPTS } from "../src/conversation/crm-sync.js";
import { messagePreview } from "../src/conversation/inbound.js";
import { parseEncryptionKey } from "../src/lib/crypto.js";
import { e164ToWaId } from "../src/lib/phone.js";
import { createPrisma, type Db } from "../src/lib/prisma.js";
import {
  altamiraConfig,
  altamiraInstructions,
  SAMPLE_KNOWLEDGE,
  SAMPLE_KNOWLEDGE_NAME,
} from "./seed-data/altamira.js";
import { DEMO_THREADS } from "./seed-data/demo-threads.js";

/** Keeps the newest settings version of each kind equal to what the seed just wrote. */
async function recordSeedVersions(
  db: Db,
  company: {
    id: string;
    config: CompanyConfig;
    instructions: string;
    whatsappPhoneNumberId: string | null;
  },
) {
  const {
    id: companyId,
    config,
    instructions,
    whatsappPhoneNumberId,
  } = company;
  const latest = (kind: "config" | "instructions" | "whatsappPhoneNumberId") =>
    db.companySettingsVersion.findFirst({
      where: { companyId, kind },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  const lastConfig = await latest("config");
  if (
    !lastConfig?.config ||
    JSON.stringify(parseCompanyConfig(lastConfig.config)) !==
      JSON.stringify(config)
  ) {
    await db.companySettingsVersion.create({
      data: { companyId, kind: "config", config },
    });
  }
  const lastInstructions = await latest("instructions");
  if (lastInstructions?.instructions !== instructions) {
    await db.companySettingsVersion.create({
      data: { companyId, kind: "instructions", instructions },
    });
  }
  const lastPhoneNumberId = await latest("whatsappPhoneNumberId");
  if (
    !lastPhoneNumberId ||
    lastPhoneNumberId.whatsappPhoneNumberId !== whatsappPhoneNumberId
  ) {
    await db.companySettingsVersion.create({
      data: { companyId, kind: "whatsappPhoneNumberId", whatsappPhoneNumberId },
    });
  }
}

/**
 * Local fixture only: the Altamira company, one operator, a sample knowledge file, and demo
 * conversations. A production setup does not run this. The first company is created from
 * Empresas. Existing secrets, files, and threads are left alone.
 */
async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "db:seed is a local fixture. A production setup does not run it. Create the company from Empresas.",
    );
  }
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  const key = parseEncryptionKey(env.SECRETS_ENCRYPTION_KEY);
  const phoneNumberIdOverride =
    process.env.SEED_WHATSAPP_PHONE_NUMBER_ID || undefined;
  const phoneNumberId = phoneNumberIdOverride ?? "DEV_PHONE_NUMBER_ID";
  const operatorEmail = (
    process.env.SEED_OPERATOR_EMAIL || "operador@example.com"
  ).toLowerCase();
  const withDemoData = env.NODE_ENV !== "production";

  const existing = await db.company.findUnique({ where: { slug: "altamira" } });
  const secrets = existing
    ? decryptSecrets(existing.encryptedSecrets, key)
    : {};
  if (!secrets.formLeadSecret && withDemoData)
    secrets.formLeadSecret = "dev-form-secret";
  // `npm run webhook:send` signs with this, as Kapso would with the webhook's secret key.
  if (!secrets.kapsoWebhookSecret && withDemoData)
    secrets.kapsoWebhookSecret = "dev-kapso-webhook-secret";

  const config = parseCompanyConfig(altamiraConfig);
  const company = await db.company.upsert({
    where: { slug: "altamira" },
    create: {
      slug: "altamira",
      name: "Altamira",
      config,
      instructions: altamiraInstructions,
      whatsappPhoneNumberId: phoneNumberId,
      encryptedSecrets: encryptSecrets(secrets, key),
    },
    update: {
      config,
      instructions: altamiraInstructions,
      encryptedSecrets: encryptSecrets(secrets, key),
      ...(phoneNumberIdOverride
        ? { whatsappPhoneNumberId: phoneNumberIdOverride }
        : {}),
    },
  });
  await recordSeedVersions(db, {
    id: company.id,
    config,
    instructions: altamiraInstructions,
    whatsappPhoneNumberId: company.whatsappPhoneNumberId,
  });

  await db.operator.upsert({
    where: { email: operatorEmail },
    create: { email: operatorEmail, companyId: company.id },
    update: {},
  });

  if (
    withDemoData &&
    (await db.knowledgeFile.count({ where: { companyId: company.id } })) === 0
  ) {
    await db.knowledgeFile.create({
      data: {
        companyId: company.id,
        name: SAMPLE_KNOWLEDGE_NAME,
        nameKey: SAMPLE_KNOWLEDGE_NAME,
        format: "md",
        mimeType: "text/markdown",
        sizeBytes: Buffer.byteLength(SAMPLE_KNOWLEDGE),
        sha256: "seed",
        text: SAMPLE_KNOWLEDGE.trim(),
        charCount: SAMPLE_KNOWLEDGE.trim().length,
      },
    });
  }

  let demoThreads = 0;
  if (
    withDemoData &&
    (await db.thread.count({ where: { companyId: company.id } })) === 0
  ) {
    const now = Date.now();
    const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);
    // The bot answers a few seconds after the lead, never at the same instant.
    const sentAt = (message: { from: "lead" | "bot"; minutesAgo: number }) =>
      new Date(
        at(message.minutesAgo).getTime() +
          (message.from === "bot" ? 20_000 : 0),
      );
    for (const demo of DEMO_THREADS) {
      const last = demo.messages.at(-1)!;
      const lastInbound = [...demo.messages]
        .reverse()
        .find((message) => message.from === "lead");
      const crm = demo.crm;
      await db.thread.create({
        data: {
          companyId: company.id,
          phone: demo.phone,
          waId: e164ToWaId(demo.phone),
          name: demo.name,
          email: demo.email,
          source: demo.source ?? "whatsapp",
          state: demo.state,
          paused: demo.paused ?? false,
          pausedAt: demo.paused ? at(last.minutesAgo - 1) : null,
          needsHuman: Boolean(demo.needsHuman),
          needsHumanReason: demo.needsHuman ?? null,
          interest: demo.interest,
          budget: demo.budget,
          knowsProjects: demo.knowsProjects,
          callTime: demo.callTime,
          lastInboundAt: lastInbound ? at(lastInbound.minutesAgo) : null,
          lastMessageAt: sentAt(last),
          lastMessagePreview: messagePreview(last.type ?? "text", last.text),
          createdAt: sentAt(demo.messages[0]!),
          crmContactId: crm?.synced ? `demo-${demo.phone.slice(-3)}` : null,
          crmSyncedAt: crm?.synced ? at(last.minutesAgo) : null,
          crmPendingAction:
            crm && !crm.synced ? (crm.action ?? "handoff") : null,
          crmLastError: crm?.error ?? null,
          crmAttempts: crm && !crm.synced ? MAX_CRM_ATTEMPTS : 0,
          messages: {
            create: demo.messages.map((message, index) => ({
              companyId: company.id,
              direction: message.from === "lead" ? "inbound" : "outbound",
              type: message.type ?? "text",
              body: message.text,
              waMessageId: `wamid.demo.${demo.phone.slice(-3)}.${index}`,
              status: message.from === "bot" ? "read" : null,
              handledAt:
                message.from === "lead" ? at(message.minutesAgo) : null,
              sentAt: sentAt(message),
            })),
          },
        },
      });
      demoThreads += 1;
    }
  }

  console.log(
    `Seeded company "${company.slug}" (phone number id ${company.whatsappPhoneNumberId}), operator ${operatorEmail}` +
      (demoThreads ? `, ${demoThreads} demo threads` : ""),
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
