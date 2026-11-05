import type { Company } from "../generated/prisma/client.js";
import type { Logger } from "../lib/logger.js";
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
 * A company whose secrets cannot be decrypted stays undecided (HubSpot off) and is retried on the
 * next start, so it never blocks the others. Returns how many companies were decided.
 */
export async function backfillHubspotEnabled(
  db: Db,
  encryptionKey: Buffer,
  logger: Pick<Logger, "error">,
): Promise<number> {
  const rows = await db.company.findMany({
    where: { hubspotEnabled: null },
    select: { id: true, encryptedSecrets: true },
  });
  let decided = 0;
  for (const row of rows) {
    let hubspotAccessToken: string | undefined;
    try {
      ({ hubspotAccessToken } = decryptSecrets(
        row.encryptedSecrets,
        encryptionKey,
      ));
    } catch (error) {
      logger.error(
        { err: error, companyId: row.id },
        "cannot decrypt company secrets; hubspot switch left undecided",
      );
      continue;
    }
    await db.company.updateMany({
      where: { id: row.id, hubspotEnabled: null },
      data: { hubspotEnabled: Boolean(hubspotAccessToken) },
    });
    decided += 1;
  }
  return decided;
}
