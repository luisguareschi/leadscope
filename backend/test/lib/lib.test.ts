import { describe, expect, it } from "vitest";
import { decryptSecrets, encryptSecrets } from "../../src/companies/company-secrets.js";
import { loadEnv } from "../../src/config/env.js";
import { decrypt, encrypt, parseEncryptionKey } from "../../src/lib/crypto.js";
import { toE164, waIdToE164 } from "../../src/lib/phone.js";

describe("phone numbers", () => {
  it.each([
    ["+598 99 123 456", "+59899123456"],
    ["099 123 456", "+59899123456"],
    ["0059899123456", "+59899123456"],
    ["59899123456", "+59899123456"],
    ["(099) 123-456", "+59899123456"],
  ])("normalizes form input %s", (raw, expected) => {
    expect(toE164(raw, "UY")).toBe(expected);
  });

  it("rejects numbers that are not valid", () => {
    expect(toE164("123", "UY")).toBeNull();
    expect(toE164("", "UY")).toBeNull();
  });

  it("reads WhatsApp ids as international numbers", () => {
    expect(waIdToE164("59899123456")).toBe("+59899123456");
    expect(waIdToE164("34695403932")).toBe("+34695403932");
  });
});

describe("secrets encryption", () => {
  const key = parseEncryptionKey(Buffer.alloc(32, 1).toString("base64"));

  it("round-trips and uses a fresh IV every time", () => {
    const first = encrypt("sk-ant-123", key);
    expect(first).not.toBe(encrypt("sk-ant-123", key));
    expect(decrypt(first, key)).toBe("sk-ant-123");
  });

  it("refuses a tampered payload or the wrong key", () => {
    const payload = encrypt("secret", key);
    const [version, iv, tag, data] = payload.split(".");
    const tampered = [version, iv, tag, Buffer.from("other").toString("base64")].join(".");
    expect(() => decrypt(tampered, key)).toThrow();
    expect(() => decrypt(payload, parseEncryptionKey(Buffer.alloc(32, 2).toString("base64")))).toThrow();
    expect(data).toBeTruthy();
  });

  it("stores company secrets as one encrypted blob", () => {
    const blob = encryptSecrets({ anthropicApiKey: "sk-ant", hubspotAccessToken: "pat" }, key);
    expect(blob).not.toContain("sk-ant");
    expect(decryptSecrets(blob, key)).toEqual({ anthropicApiKey: "sk-ant", hubspotAccessToken: "pat" });
    expect(decryptSecrets(null, key)).toEqual({});
  });

  it("insists on a 32-byte key", () => {
    expect(() => parseEncryptionKey(Buffer.alloc(16).toString("base64"))).toThrow("32 bytes");
  });
});

describe("environment", () => {
  const base = {
    DATABASE_URL: "postgresql://x",
    SECRETS_ENCRYPTION_KEY: "k",
    META_APP_SECRET: "s",
    META_WEBHOOK_VERIFY_TOKEN: "t",
  };

  it("refuses dev auth and fake integrations in production", () => {
    expect(() => loadEnv({ ...base, NODE_ENV: "production", AUTH_MODE: "dev" })).toThrow("dev auth is not allowed");
    expect(() =>
      loadEnv({ ...base, NODE_ENV: "production", ALLOW_FAKE_INTEGRATIONS: "true", SUPABASE_URL: "https://x.supabase.co" }),
    ).toThrow("fake integrations are not allowed");
    expect(() => loadEnv({ ...base, NODE_ENV: "production" })).toThrow("SUPABASE_URL");
  });

  it("accepts a production config", () => {
    const env = loadEnv({ ...base, NODE_ENV: "production", SUPABASE_URL: "https://x.supabase.co" });
    expect(env).toMatchObject({ AUTH_MODE: "supabase", ALLOW_FAKE_INTEGRATIONS: false });
  });
});
