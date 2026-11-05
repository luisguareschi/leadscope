import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { checkHubspot } from "../../integrations/crm/hubspot-check.js";
import {
  checkResult,
  type IntegrationCheck,
} from "../../integrations/integration-check.js";
import { saveHubspotAccount } from "./hubspot-account.js";

/**
 * Probar conexión for HubSpot: token valid, scopes, and the long-text property, all read-only.
 * A valid token also saves the account's id and UI host, for the "Abrir en HubSpot" link.
 */
export async function checkHubspotConnection(
  ctx: AppContext,
  companyId: string,
) {
  const company = await loadCompanyById(ctx.db, companyId, ctx.encryptionKey);
  const token = company.secrets.hubspotAccessToken;
  const enabled: IntegrationCheck = company.hubspot.enabled
    ? {
        id: "enabled",
        status: "ok",
        label: "HubSpot activado",
        detail: "Cada lead se crea en HubSpot desde su primer mensaje.",
      }
    : {
        id: "enabled",
        status: "warning",
        label: "HubSpot apagado",
        detail:
          "La prueba funciona igual, pero no se escribe nada en HubSpot hasta que lo actives.",
      };
  if (!token)
    return checkResult([
      enabled,
      {
        id: "token",
        status: "error",
        label: "Token de HubSpot",
        detail:
          "Falta. Créalo en HubSpot con una app privada y pégalo en Token de HubSpot.",
      },
    ]);
  const result = await checkHubspot(
    ctx.integrations.hubspotFetch,
    token,
    company.config.crm.transcriptProperty,
  );
  if (result.account) await saveHubspotAccount(ctx, companyId, result.account);
  return {
    ...checkResult([enabled, ...result.checks]),
    account: result.account,
  };
}
