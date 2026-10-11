import type { Env } from "./config/env.js";
import type { AppContext } from "./context.js";
import { processThread } from "./conversation/process-thread.js";
import { ReplyScheduler } from "./conversation/reply-scheduler.js";
import { createIntegrations, type Integrations } from "./integrations/registry.js";
import { parseEncryptionKey } from "./lib/crypto.js";
import { logger as defaultLogger, type Logger } from "./lib/logger.js";
import { createPrisma, type Db } from "./lib/prisma.js";

export type ContextOptions = {
  db?: Db;
  integrations?: Integrations;
  logger?: Logger;
  now?: () => Date;
};

export function createContext(env: Env, options: ContextOptions = {}): AppContext {
  const logger = options.logger ?? defaultLogger;
  const ctx = {
    env,
    db: options.db ?? createPrisma(env.DATABASE_URL),
    encryptionKey: parseEncryptionKey(env.SECRETS_ENCRYPTION_KEY),
    integrations: options.integrations ?? createIntegrations(env),
    logger,
    now: options.now ?? (() => new Date()),
  } as AppContext;
  ctx.replies = new ReplyScheduler(
    async (threadId) => {
      await processThread(ctx, threadId);
    },
    { debounceMs: env.REPLY_DEBOUNCE_MS, maxWaitMs: Math.max(env.REPLY_DEBOUNCE_MS * 4, 15_000), logger },
  );
  return ctx;
}
