import { z } from "zod";
import { decrypt, encrypt } from "../lib/crypto.js";

export const companySecretsSchema = z.object({
  anthropicApiKey: z.string().min(1).optional(),
  /** Project API key of the company's Kapso project. Sends WhatsApp messages and runs the connection check. */
  kapsoApiKey: z.string().min(1).optional(),
  /** `secret_key` of the company's Kapso webhook. Verifies `X-Webhook-Signature` on inbound webhooks. */
  kapsoWebhookSecret: z.string().min(1).optional(),
  hubspotAccessToken: z.string().min(1).optional(),
  /** Shared secret the CRM workflow sends when it reports a form lead. */
  formLeadSecret: z.string().min(1).optional(),
});

export type CompanySecrets = z.infer<typeof companySecretsSchema>;
export type CompanySecretName = keyof CompanySecrets;
export const COMPANY_SECRET_NAMES = Object.keys(
  companySecretsSchema.shape,
) as CompanySecretName[];

/**
 * Secrets older deployments stored that nothing reads now. Decrypting drops them (the schema strips
 * unknown keys), so the next save of any secret removes them; `npm run secrets:prune` does it now.
 */
export const LEGACY_SECRET_NAMES = ["metaAccessToken"] as const;

export function encryptSecrets(secrets: CompanySecrets, key: Buffer): string {
  return encrypt(JSON.stringify(companySecretsSchema.parse(secrets)), key);
}

export function decryptSecrets(
  payload: string | null,
  key: Buffer,
): CompanySecrets {
  if (!payload) return {};
  return companySecretsSchema.parse(JSON.parse(decrypt(payload, key)));
}

/** Names of legacy secrets still present in a stored payload. */
export function legacySecretsIn(payload: string | null, key: Buffer): string[] {
  if (!payload) return [];
  const raw = JSON.parse(decrypt(payload, key)) as Record<string, unknown>;
  return LEGACY_SECRET_NAMES.filter((name) => name in raw);
}
