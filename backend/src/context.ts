import type { Env } from "./config/env.js";
import type { ReplyScheduler } from "./conversation/reply-scheduler.js";
import type { Integrations } from "./integrations/registry.js";
import type { Logger } from "./lib/logger.js";
import type { Db } from "./lib/prisma.js";

/** Everything a controller, service, or job needs. Built once at startup (or per test). */
export type AppContext = {
  env: Env;
  db: Db;
  encryptionKey: Buffer;
  integrations: Integrations;
  logger: Logger;
  replies: ReplyScheduler;
  now: () => Date;
};
