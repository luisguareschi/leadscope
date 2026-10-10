import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";

const secretsSchema = z.object({
  anthropicApiKey: z.string().default(""),
  hubspotAccessToken: z.string().default(""),
  metaAccessToken: z.string().default(""),
  googleAccessJson: z.string().default(""),
  formLeadSecret: z.string().default(""),
});

export type CompanySecrets = z.infer<typeof secretsSchema>;

export function emptySecrets(): CompanySecrets {
  return secretsSchema.parse({});
}

export function decodeEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, "hex");
  const decoded = Buffer.from(trimmed, "base64");
  if (decoded.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY must be 32 bytes, base64 or hex");
  }
  return decoded;
}

/** AES-256-GCM. Layout: 12-byte iv, 16-byte tag, ciphertext. */
export function encryptJson(value: unknown, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptJson(payload: string, key: Buffer): unknown {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as unknown;
}

export function encryptSecrets(secrets: CompanySecrets, key: Buffer): string {
  return encryptJson(secretsSchema.parse(secrets), key);
}

export function decryptSecrets(payload: string | null, key: Buffer | null): CompanySecrets {
  if (!payload || !key) return emptySecrets();
  return secretsSchema.parse(decryptJson(payload, key));
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
