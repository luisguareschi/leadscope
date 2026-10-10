import type { Company } from "../generated/prisma/client.js";
import type { Db } from "../lib/prisma.js";
import { parseCompanyConfig, type CompanyConfig } from "./company-config.js";
import { decryptSecrets, type CompanySecrets } from "./company-secrets.js";

export type LoadedCompany = {
  id: string;
  slug: string;
  name: string;
  whatsappPhoneNumberId: string | null;
  config: CompanyConfig;
  secrets: CompanySecrets;
};

export async function loadCompanyById(db: Db, companyId: string, encryptionKey: Buffer): Promise<LoadedCompany> {
  return loadCompany(await db.company.findUniqueOrThrow({ where: { id: companyId } }), encryptionKey);
}

export function loadCompany(row: Company, encryptionKey: Buffer): LoadedCompany {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    whatsappPhoneNumberId: row.whatsappPhoneNumberId,
    config: parseCompanyConfig(row.config),
    secrets: decryptSecrets(row.encryptedSecrets, encryptionKey),
  };
}
