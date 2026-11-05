import { hubspotSettingsOf } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { CRM_OUTBOX_CLEARED } from "../../conversation/crm-sync.js";

/**
 * Configuración → HubSpot's switch. Off drops every write the company still owed, so nothing is
 * retried. On writes nothing by itself: a lead HubSpot never had is created on their next message.
 */
export async function setHubspotEnabled(
  ctx: AppContext,
  companyId: string,
  enabled: boolean,
) {
  const company = await ctx.db.$transaction(async (tx) => {
    const updated = await tx.company.update({
      where: { id: companyId },
      data: { hubspotEnabled: enabled },
      select: {
        hubspotEnabled: true,
        hubspotPortalId: true,
        hubspotUiDomain: true,
      },
    });
    if (!enabled)
      await tx.thread.updateMany({
        where: { companyId, crmPendingAction: { not: null } },
        data: CRM_OUTBOX_CLEARED,
      });
    return updated;
  });
  return hubspotSettingsOf(company);
}
