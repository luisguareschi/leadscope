import { loadEnv, type Env } from "../../src/config/env.js";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://leadscope:leadscope@localhost:5432/leadscope_test";

export const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
export const TEST_APP_SECRET = "test-app-secret";

export function testEnv(overrides: Record<string, string> = {}): Env {
  return loadEnv({
    NODE_ENV: "test",
    DATABASE_URL: TEST_DATABASE_URL,
    SECRETS_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    META_APP_SECRET: TEST_APP_SECRET,
    META_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
    AUTH_MODE: "dev",
    ALLOW_FAKE_INTEGRATIONS: "true",
    REPLY_DEBOUNCE_MS: "0",
    LOG_LEVEL: "silent",
    BACKOFFICE_ORIGIN: "http://localhost:3000",
    ...overrides,
  });
}
