import type { AppContext } from "../../context.js";
import {
  fetchHubspotAccount,
  type HubspotAccount,
} from "../../integrations/crm/hubspot-check.js";

export async function saveHubspotAccount(
  ctx: AppContext,
  companyId: string,
  account: HubspotAccount | null,
): Promise<void> {
  await ctx.db.company.update({
    where: { id: companyId },
    data: {
      hubspotPortalId: account?.portalId ?? null,
      hubspotUiDomain: account?.uiDomain ?? null,
    },
  });
}

/**
 * Right after a new token is saved: reads the account it belongs to, for the "Abrir en HubSpot"
 * link. A token HubSpot refuses (401) forgets the old account; any other failure keeps it, and
 * Probar conexión tries again.
 */
export async function refreshHubspotAccount(
  ctx: AppContext,
  companyId: string,
  token: string,
): Promise<void> {
  try {
    const account = await fetchHubspotAccount(
      ctx.integrations.hubspotFetch,
      token,
    );
    await saveHubspotAccount(ctx, companyId, account);
  } catch (error) {
    ctx.logger.warn(
      { err: error, companyId },
      "hubspot account info failed; keeping the stored one",
    );
  }
}
