import { PrismaClient } from "@prisma/client";
import { seedDemoThreads } from "./companies/demo-threads";
import { ensureSampleKnowledge } from "./companies/sample-knowledge";
import { seedAltamira } from "./companies/seed";
import { assertProductionEnv, loadEnv } from "./env";
import { decodeEncryptionKey } from "./crypto/secrets";
import { RoutingCrm } from "./integrations/crm/hubspot";
import { RoutingChannel } from "./integrations/whatsapp/client";
import { complete } from "./llm/complete";
import { initSentry, log } from "./logger";
import { burstsFor, createApp } from "./app";
import { readCompany } from "./companies/load";

async function main(): Promise<void> {
  const env = loadEnv();
  assertProductionEnv(env);
  await initSentry();

  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!env.SECRETS_ENCRYPTION_KEY) throw new Error("SECRETS_ENCRYPTION_KEY is required");
  const key = decodeEncryptionKey(env.SECRETS_ENCRYPTION_KEY);
  const db = new PrismaClient();

  if (env.NODE_ENV === "development") {
    if ((await db.company.count()) === 0) {
      await seedAltamira(db, key, {
        email: env.SEED_OPERATOR_EMAIL,
        supabaseUserId: env.SEED_OPERATOR_SUPABASE_USER_ID,
      });
      log.info("seeded the Altamira company into the empty development database");
    }
    const sampleFiles = await ensureSampleKnowledge(db);
    if (sampleFiles > 0) {
      log.info({ sampleFiles }, "seeded a sample knowledge file where a company had none");
    }
    const demoThreads = await seedDemoThreads(db);
    if (demoThreads > 0) {
      log.info({ demoThreads }, "seeded sample threads into the empty development database");
    }
  }

  const channel = new RoutingChannel();
  const crm = new RoutingCrm(async (companyId) => {
    const row = await db.company.findUnique({ where: { id: companyId } });
    return row ? readCompany(row, key).secrets.hubspotAccessToken : "";
  });
  const processor = { db, key, channel, crm, complete, model: env.ANTHROPIC_MODEL };
  const bursts = burstsFor(processor, env.BURST_WAIT_MS);
  const app = createApp({ ...processor, env, bursts });

  app.listen(env.PORT, () => {
    log.info({ port: env.PORT }, "backend listening");
  });
}

main().catch((err) => {
  log.error({ err }, "backend failed to start");
  process.exit(1);
});
