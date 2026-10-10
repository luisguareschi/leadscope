import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.string().default("info"),
  DATABASE_URL: z.string().optional().default(""),
  DIRECT_URL: z.string().optional().default(""),
  SECRETS_ENCRYPTION_KEY: z.string().optional().default(""),
  AUTH_MODE: z.enum(["fake", "supabase"]).default("fake"),
  SUPABASE_URL: z.string().optional().default(""),
  SUPABASE_JWT_SECRET: z.string().optional().default(""),
  META_APP_SECRET: z.string().optional().default(""),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(""),
  BACKOFFICE_ORIGIN: z.string().default("http://localhost:3000"),
  BURST_WAIT_MS: z.coerce.number().default(3000),
  KNOWLEDGE_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  SENTRY_DSN: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().default("claude-haiku-4-5"),
  SEED_OPERATOR_EMAIL: z.string().default("operador@example.com"),
  SEED_OPERATOR_SUPABASE_USER_ID: z.string().default("fake-user"),
});

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return schema.parse(source);
}

export function assertProductionEnv(env: Env): void {
  if (env.NODE_ENV !== "production") return;
  if (env.AUTH_MODE === "fake") {
    throw new Error("AUTH_MODE=fake is not allowed in production");
  }
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required in production");
  if (!env.SECRETS_ENCRYPTION_KEY) {
    throw new Error("SECRETS_ENCRYPTION_KEY is required in production");
  }
  if (!env.META_APP_SECRET || !env.META_WEBHOOK_VERIFY_TOKEN) {
    throw new Error("Meta app secret and webhook verify token are required in production");
  }
}
