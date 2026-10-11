import { COMPANY_SECRET_NAMES, decryptSecrets } from "../../companies/company-secrets.js";
import type { AppContext } from "../../context.js";
import { toSecretStatus, type SecretStatus } from "./secret-dto.js";

export async function getSecrets(ctx: AppContext, companyId: string): Promise<{ secrets: SecretStatus[] }> {
  const company = await ctx.db.company.findUniqueOrThrow({ where: { id: companyId } });
  const secrets = decryptSecrets(company.encryptedSecrets, ctx.encryptionKey);
  return { secrets: COMPANY_SECRET_NAMES.map((name) => toSecretStatus(name, secrets[name])) };
}
