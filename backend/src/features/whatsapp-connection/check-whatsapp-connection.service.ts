import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import {
  checkKapsoConnection,
  type ConnectionCheck,
} from "../../integrations/whatsapp/kapso/kapso-connection.js";
import { kapsoWebhookPath } from "../../integrations/whatsapp/kapso/kapso-webhook-path.js";

export type WhatsappConnectionCheck = {
  webhookPath: string;
  /** Every check passed, possibly with warnings: the bot can receive and answer. */
  ready: boolean;
  checks: ConnectionCheck[];
};

/**
 * Configuración → Integraciones → Probar conexión. Checks what this company saved, then asks Kapso
 * whether the number is healthy and whether a v2 webhook points at this company's URL.
 */
export async function checkWhatsappConnection(
  ctx: AppContext,
  companyId: string,
): Promise<WhatsappConnectionCheck> {
  const company = await loadCompanyById(ctx.db, companyId, ctx.encryptionKey);
  const webhookPath = kapsoWebhookPath(company.slug);
  const { kapsoApiKey, kapsoWebhookSecret } = company.secrets;
  const local: ConnectionCheck[] = [
    company.whatsappPhoneNumberId
      ? {
          id: "phoneNumberId",
          status: "ok",
          label: "Phone number ID",
          detail: company.whatsappPhoneNumberId,
        }
      : {
          id: "phoneNumberId",
          status: "error",
          label: "Phone number ID",
          detail:
            "Falta. Copialo del número conectado en Kapso y guardalo en Asistente → WhatsApp.",
        },
    kapsoApiKey
      ? {
          id: "apiKey",
          status: "ok",
          label: "Clave de API de Kapso",
          detail: "Guardada.",
        }
      : {
          id: "apiKey",
          status: "error",
          label: "Clave de API de Kapso",
          detail: "Falta. Creala en Kapso (Integrations → API keys).",
        },
    kapsoWebhookSecret
      ? {
          id: "webhookSecret",
          status: "ok",
          label: "Clave secreta del webhook",
          detail: "Guardada.",
        }
      : {
          id: "webhookSecret",
          status: "error",
          label: "Clave secreta del webhook",
          detail:
            "Falta. Sin ella LeadScope rechaza todo lo que manda Kapso (401).",
        },
  ];
  const remote: ConnectionCheck[] =
    kapsoApiKey && company.whatsappPhoneNumberId
      ? await checkKapsoConnection(
          { apiKey: kapsoApiKey, fetchImpl: ctx.integrations.kapsoFetch },
          {
            phoneNumberId: company.whatsappPhoneNumberId,
            webhookPath,
            webhookSecret: kapsoWebhookSecret,
          },
        )
      : [
          {
            id: "number",
            status: "skipped",
            label: "Número conectado en Kapso",
            detail:
              "Se prueba cuando estén la clave de API y el Phone number ID.",
          },
          {
            id: "webhook",
            status: "skipped",
            label: "Webhook hacia LeadScope",
            detail:
              "Se prueba cuando estén la clave de API y el Phone number ID.",
          },
        ];
  const checks = [...local, ...remote];
  return {
    webhookPath,
    ready: checks.every(
      (check) => check.status === "ok" || check.status === "warning",
    ),
    checks,
  };
}
