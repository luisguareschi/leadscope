import { createApp, burstsFor } from "./app";
import { seedDemoThreads } from "./companies/demo-threads";
import { seedAltamira } from "./companies/seed";
import { assertProductionEnv, loadEnv } from "./env";
import { decodeEncryptionKey } from "./crypto/secrets";
import { RoutingCrm } from "./integrations/crm/hubspot";
import { RoutingChannel } from "./integrations/whatsapp/client";
import { startJobs } from "./jobs/scheduler";
import { complete } from "./llm/complete";
import { initSentry, log } from "./logger";
import { MemoryStore } from "./store/memory";
import { PrismaStore } from "./store/prisma";
import { PrismaClient } from "@prisma/client";
import { Store } from "./store/types";

async function main(): Promise<void> {
  const env = loadEnv();
  assertProductionEnv(env);
  await initSentry();

  let store: Store;
  if (env.DATABASE_URL) {
    const key = env.SECRETS_ENCRYPTION_KEY ? decodeEncryptionKey(env.SECRETS_ENCRYPTION_KEY) : null;
    store = new PrismaStore(new PrismaClient(), key);
    log.info("using postgres");
  } else {
    if (env.NODE_ENV === "production") throw new Error("DATABASE_URL is required in production");
    const memory = new MemoryStore();
    await seedAltamira(memory, {
      email: env.SEED_OPERATOR_EMAIL,
      supabaseUserId: env.SEED_OPERATOR_SUPABASE_USER_ID,
    });
    const demoThreads = await seedDemoThreads(memory);
    store = memory;
    log.warn(
      { demoThreads },
      "DATABASE_URL is empty; using an in-memory store with sample threads. They are not inserted when DATABASE_URL is set",
    );
  }

  const channel = new RoutingChannel();
  const crm = new RoutingCrm(async (companyId) => {
    const company = await store.getCompany(companyId);
    return company?.secrets.hubspotAccessToken ?? "";
  });
  const processor = { store, channel, crm, complete, model: env.ANTHROPIC_MODEL };
  const bursts = burstsFor(processor, env.BURST_WAIT_MS);
  const app = createApp({ ...processor, env, bursts });

  if (env.NODE_ENV !== "test") {
    startJobs({
      store,
      sheetIntervalMs: env.SHEET_SYNC_INTERVAL_MS,
      siteIntervalMs: env.SITE_NOTES_INTERVAL_MS,
      platformServiceAccountJson: env.GOOGLE_SERVICE_ACCOUNT_JSON,
    });
  }

  app.listen(env.PORT, () => {
    log.info({ port: env.PORT }, "backend listening");
  });
}

main().catch((err) => {
  log.error({ err }, "backend failed to start");
  process.exit(1);
});
