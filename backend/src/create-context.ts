import type { Env } from "./config/env.js";
import type { AppContext } from "./context.js";
import { CrmQueue } from "./conversation/crm-queue.js";
import { syncWithCrmLease } from "./conversation/crm-sync.js";
import { processThread } from "./conversation/process-thread.js";
import { ReplyScheduler } from "./conversation/reply-scheduler.js";
import {
  createAuthAdmin,
  type AuthAdmin,
} from "./integrations/auth/auth-admin.js";
import {
  createIntegrations,
  type Integrations,
} from "./integrations/registry.js";
import {
  createFileStorage,
  type FileStorage,
} from "./integrations/storage/storage.js";
import { parseEncryptionKey } from "./lib/crypto.js";
import { createLoggedFetch } from "./lib/logged-fetch.js";
import { logger as defaultLogger, type Logger } from "./lib/logger.js";
import { createPrisma, type Db } from "./lib/prisma.js";

export type ContextOptions = {
  db?: Db;
  integrations?: Integrations;
  storage?: FileStorage;
  authAdmin?: AuthAdmin;
  logger?: Logger;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function createContext(
  env: Env,
  options: ContextOptions = {},
): AppContext {
  const logger = options.logger ?? defaultLogger;
  const ctx = {
    env,
    db: options.db ?? createPrisma(env.DATABASE_URL),
    encryptionKey: parseEncryptionKey(env.SECRETS_ENCRYPTION_KEY),
    integrations: options.integrations ?? createIntegrations(env, { logger }),
    storage:
      options.storage ??
      createFileStorage(env, createLoggedFetch(logger, "supabase-storage")),
    authAdmin:
      options.authAdmin ??
      createAuthAdmin(env, createLoggedFetch(logger, "supabase-auth")),
    logger,
    now: options.now ?? (() => new Date()),
    sleep: options.sleep ?? defaultSleep,
  } as AppContext;
  ctx.replies = new ReplyScheduler(
    async (threadId) => {
      await processThread(ctx, threadId);
    },
    {
      debounceMs: env.REPLY_DEBOUNCE_MS,
      maxWaitMs: Math.max(env.REPLY_DEBOUNCE_MS * 4, 15_000),
      logger,
    },
  );
  ctx.crm = new CrmQueue(async (threadId) => {
    await syncWithCrmLease(ctx, threadId);
  }, logger);
  return ctx;
}
