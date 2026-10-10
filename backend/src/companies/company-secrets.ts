import { z } from "zod";
import { decrypt, encrypt } from "../lib/crypto.js";

export const companySecretsSchema = z.object({
  anthropicApiKey: z.string().min(1).optional(),
  metaAccessToken: z.string().min(1).optional(),
  hubspotAccessToken: z.string().min(1).optional(),
  /** Shared secret the CRM workflow sends when it reports a form lead. */
  formLeadSecret: z.string().min(1).optional(),
});

export type CompanySecrets = z.infer<typeof companySecretsSchema>;
export type CompanySecretName = keyof CompanySecrets;
export const COMPANY_SECRET_NAMES = Object.keys(companySecretsSchema.shape) as CompanySecretName[];

export function encryptSecrets(secrets: CompanySecrets, key: Buffer): string {
  return encrypt(JSON.stringify(companySecretsSchema.parse(secrets)), key);
}

export function decryptSecrets(payload: string | null, key: Buffer): CompanySecrets {
  if (!payload) return {};
  return companySecretsSchema.parse(JSON.parse(decrypt(payload, key)));
}
