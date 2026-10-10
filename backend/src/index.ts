import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { startSweeper } from "./conversation/sweeper.js";
import { createContext } from "./create-context.js";
import { logger } from "./lib/logger.js";
import { initMonitoring, reportError } from "./lib/monitoring.js";

const env = loadEnv();
logger.level = env.LOG_LEVEL;
initMonitoring(env.SENTRY_DSN, env.NODE_ENV);
const ctx = createContext(env);
const app = createApp(ctx);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, authMode: env.AUTH_MODE, fakes: env.ALLOW_FAKE_INTEGRATIONS }, "leadscope backend listening");
});
const stopSweeper = startSweeper(ctx);

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  stopSweeper();
  server.close();
  // Finish turns already running; anything still pending is picked up by the next process.
  ctx.replies.stop();
  await Promise.race([ctx.replies.drain(), new Promise((resolve) => setTimeout(resolve, 20_000))]);
  await ctx.db.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("unhandledRejection", (error) => {
  logger.error({ err: error }, "unhandled rejection");
  reportError(error);
});
