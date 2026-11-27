import { createApp } from "./app.js";
import { backfillHubspotEnabled } from "./companies/load-company.js";
import { loadEnv } from "./config/env.js";
import { startSweeper } from "./conversation/sweeper.js";
import { createContext } from "./create-context.js";
import { logger } from "./lib/logger.js";
import {
  flushMonitoring,
  initMonitoring,
  reportError,
} from "./lib/monitoring.js";

const env = loadEnv();
logger.level = env.LOG_LEVEL;
initMonitoring({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  release:
    process.env.SENTRY_RELEASE?.trim() ||
    process.env.RENDER_GIT_COMMIT?.trim() ||
    undefined,
});
const ctx = createContext(env);
const app = createApp(ctx);

const decided = await backfillHubspotEnabled(
  ctx.db,
  ctx.encryptionKey,
  ctx.logger,
);
if (decided > 0)
  logger.info({ companies: decided }, "hubspot switch set from saved tokens");

const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      authMode: env.AUTH_MODE,
      fakes: env.ALLOW_FAKE_INTEGRATIONS,
    },
    "leadscope backend listening",
  );
});
const stopSweeper = startSweeper(ctx);

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  stopSweeper();
  server.close();
  // Finish turns already running; anything still pending is picked up by the next process.
  ctx.replies.stop();
  await Promise.race([
    ctx.replies.drain().then(() => ctx.crm.drain()),
    new Promise((resolve) => setTimeout(resolve, 20_000)),
  ]);
  await ctx.db.$disconnect();
  await flushMonitoring();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  logger.error({ err: error }, "unhandled rejection");
  reportError(error);
});
