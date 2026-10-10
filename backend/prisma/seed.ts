import { encryptSecrets, decryptSecrets } from "../src/companies/company-secrets.js";
import { parseCompanyConfig } from "../src/companies/company-config.js";
import { loadEnv } from "../src/config/env.js";
import { MAX_CRM_ATTEMPTS } from "../src/conversation/crm-sync.js";
import { messagePreview } from "../src/conversation/inbound.js";
import { parseEncryptionKey } from "../src/lib/crypto.js";
import { e164ToWaId } from "../src/lib/phone.js";
import { createPrisma } from "../src/lib/prisma.js";
import { altamiraConfig, SAMPLE_KNOWLEDGE, SAMPLE_KNOWLEDGE_NAME } from "./seed-data/altamira.js";
import { DEMO_THREADS } from "./seed-data/demo-threads.js";

/**
 * Idempotent development seed: the Altamira company, one operator, a sample knowledge file, and
 * demo conversations. Existing secrets, files, and threads are left alone.
 */
async function main() {
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  const key = parseEncryptionKey(env.SECRETS_ENCRYPTION_KEY);
  const phoneNumberIdOverride = process.env.SEED_WHATSAPP_PHONE_NUMBER_ID || undefined;
  const phoneNumberId = phoneNumberIdOverride ?? "DEV_PHONE_NUMBER_ID";
  const operatorEmail = (process.env.SEED_OPERATOR_EMAIL || "operador@example.com").toLowerCase();
  const withDemoData = env.NODE_ENV !== "production";

  const existing = await db.company.findUnique({ where: { slug: "altamira" } });
  const secrets = existing ? decryptSecrets(existing.encryptedSecrets, key) : {};
  if (!secrets.formLeadSecret && withDemoData) secrets.formLeadSecret = "dev-form-secret";

  const company = await db.company.upsert({
    where: { slug: "altamira" },
    create: {
      slug: "altamira",
      name: "Altamira",
      config: parseCompanyConfig(altamiraConfig),
      whatsappPhoneNumberId: phoneNumberId,
      encryptedSecrets: encryptSecrets(secrets, key),
    },
    update: {
      config: parseCompanyConfig(altamiraConfig),
      encryptedSecrets: encryptSecrets(secrets, key),
      ...(phoneNumberIdOverride ? { whatsappPhoneNumberId: phoneNumberIdOverride } : {}),
    },
  });

  await db.operator.upsert({
    where: { email: operatorEmail },
    create: { email: operatorEmail, companyId: company.id },
    update: {},
  });

  if (withDemoData && (await db.knowledgeFile.count({ where: { companyId: company.id } })) === 0) {
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
  if (withDemoData && (await db.thread.count({ where: { companyId: company.id } })) === 0) {
    const now = Date.now();
    const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);
    for (const demo of DEMO_THREADS) {
      const last = demo.messages.at(-1)!;
      const lastInbound = [...demo.messages].reverse().find((message) => message.from === "lead");
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
          lastMessageAt: at(last.minutesAgo),
          lastMessagePreview: messagePreview(last.type ?? "text", last.text),
          crmContactId: crm?.synced ? `demo-${demo.phone.slice(-3)}` : null,
          crmSyncedAt: crm?.synced ? at(last.minutesAgo) : null,
          crmPendingAction: crm && !crm.synced ? (crm.action ?? "handoff") : null,
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
              handledAt: message.from === "lead" ? at(message.minutesAgo) : null,
              sentAt: at(message.minutesAgo),
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
