import type { Company } from "../generated/prisma/client.js";
import type { Db } from "../lib/prisma.js";
import { parseCompanyConfig, type CompanyConfig } from "./company-config.js";
import { decryptSecrets, type CompanySecrets } from "./company-secrets.js";

export type HubspotSettings = {
  enabled: boolean;
  portalId: string | null;
  uiDomain: string | null;
};

export type LoadedCompany = {
  id: string;
  slug: string;
  name: string;
  whatsappPhoneNumberId: string | null;
  config: CompanyConfig;
  instructions: string;
  secrets: CompanySecrets;
  hubspot: HubspotSettings;
};

export async function loadCompanyById(
  db: Db,
  companyId: string,
  encryptionKey: Buffer,
): Promise<LoadedCompany> {
  return loadCompany(
    await db.company.findUniqueOrThrow({ where: { id: companyId } }),
    encryptionKey,
  );
}

export function hubspotSettingsOf(
  row: Pick<Company, "hubspotEnabled" | "hubspotPortalId" | "hubspotUiDomain">,
): HubspotSettings {
  return {
    enabled: row.hubspotEnabled === true,
    portalId: row.hubspotPortalId,
    uiDomain: row.hubspotUiDomain,
  };
}

export function loadCompany(
  row: Company,
  encryptionKey: Buffer,
): LoadedCompany {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    whatsappPhoneNumberId: row.whatsappPhoneNumberId,
    config: parseCompanyConfig(row.config, row.name),
    instructions: row.instructions,
    secrets: decryptSecrets(row.encryptedSecrets, encryptionKey),
    hubspot: hubspotSettingsOf(row),
  };
}

/**
 * Companies from before the HubSpot switch have no value yet. Those with a HubSpot token keep
 * writing to it (on); the rest start off. Runs on every start, before the server and the sweeper.
 */
export async function backfillHubspotEnabled(
  db: Db,
  encryptionKey: Buffer,
): Promise<number> {
  const rows = await db.company.findMany({
    where: { hubspotEnabled: null },
    select: { id: true, encryptedSecrets: true },
  });
  for (const row of rows) {
    const { hubspotAccessToken } = decryptSecrets(
      row.encryptedSecrets,
      encryptionKey,
    );
    await db.company.updateMany({
      where: { id: row.id, hubspotEnabled: null },
      data: { hubspotEnabled: Boolean(hubspotAccessToken) },
    });
  }
  return rows.length;
}
