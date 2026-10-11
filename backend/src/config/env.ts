import "dotenv/config";
import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const booleanFlag = z.preprocess(
  (value) => (typeof value === "string" ? value.toLowerCase() === "true" : value),
  z.boolean(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(3001),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    DATABASE_URL: z.string().min(1),
    SECRETS_ENCRYPTION_KEY: z.string().min(1),
    META_APP_SECRET: z.string().min(1),
    META_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
    META_GRAPH_VERSION: z.string().default("v23.0"),
    AUTH_MODE: z.enum(["dev", "supabase"]).default("supabase"),
    SUPABASE_URL: optionalString,
    SUPABASE_JWT_SECRET: optionalString,
    SUPABASE_SERVICE_ROLE_KEY: optionalString,
    BACKOFFICE_ORIGIN: z.string().default("http://localhost:3000"),
    ALLOW_FAKE_INTEGRATIONS: booleanFlag.default(false),
    ANTHROPIC_API_KEY: optionalString,
    REPLY_DEBOUNCE_MS: z.coerce.number().int().min(0).default(3500),
    SENTRY_DSN: optionalString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== "production") return;
    if (env.AUTH_MODE === "dev") {
      ctx.addIssue({ code: "custom", path: ["AUTH_MODE"], message: "dev auth is not allowed in production" });
    }
    if (env.ALLOW_FAKE_INTEGRATIONS) {
      ctx.addIssue({
        code: "custom",
        path: ["ALLOW_FAKE_INTEGRATIONS"],
        message: "fake integrations are not allowed in production",
      });
    }
    if (env.AUTH_MODE === "supabase" && !env.SUPABASE_URL) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_URL"], message: "required for supabase auth" });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }
  return parsed.data;
}
