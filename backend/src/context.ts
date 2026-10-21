import type { Env } from "./config/env.js";
import type { CrmQueue } from "./conversation/crm-queue.js";
import type { ReplyScheduler } from "./conversation/reply-scheduler.js";
import type { AuthAdmin } from "./integrations/auth/auth-admin.js";
import type { Integrations } from "./integrations/registry.js";
import type { Logger } from "./lib/logger.js";
import type { Db } from "./lib/prisma.js";

/** Everything a controller, service, or job needs. Built once at startup (or per test). */
export type AppContext = {
  env: Env;
  db: Db;
  encryptionKey: Buffer;
  integrations: Integrations;
  /** Panel logins: Supabase's admin API, or an in-memory fake with `AUTH_MODE=dev`. */
  authAdmin: AuthAdmin;
  logger: Logger;
  replies: ReplyScheduler;
  /** Background CRM writes; see `crmRequest` for how one is asked for. */
  crm: CrmQueue;
  now: () => Date;
};
