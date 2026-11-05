import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import {
  checkResult,
  type IntegrationCheck,
} from "../../integrations/integration-check.js";
import { checkWelcomeTemplate } from "../../integrations/whatsapp/kapso/kapso-templates.js";
import { formLeadPath } from "../form-leads/form-lead-path.js";

/**
 * Probar conexión for Formularios: the form-lead secret is set, and the welcome template exists
 * and is approved in the number's WhatsApp account (read through Kapso). No message is sent.
 */
export async function checkFormsConnection(ctx: AppContext, companyId: string) {
  const company = await loadCompanyById(ctx.db, companyId, ctx.encryptionKey);
  const { formLeadSecret, kapsoApiKey } = company.secrets;
  const template = company.config.whatsapp.welcomeTemplate;
  const checks: IntegrationCheck[] = [
    formLeadSecret
      ? {
          id: "secret",
          status: "ok",
          label: "Secreto del formulario",
          detail: "Guardado.",
        }
      : {
          id: "secret",
          status: "error",
          label: "Secreto del formulario",
          detail:
            "Falta. Sin él, LeadScope rechaza todos los leads del formulario (401).",
        },
  ];
  if (!template) {
    checks.push({
      id: "template",
      status: "warning",
      label: "Plantilla de bienvenida",
      detail:
        "La bienvenida está apagada. El lead queda registrado, pero no recibe ningún mensaje.",
    });
  } else if (!kapsoApiKey || !company.whatsappPhoneNumberId) {
    checks.push({
      id: "template",
      status: "skipped",
      label: "Plantilla de bienvenida",
      detail:
        "Se prueba cuando WhatsApp (Kapso) tenga la clave de API y el Phone number ID.",
    });
  } else {
    checks.push(
      await checkWelcomeTemplate(
        { apiKey: kapsoApiKey, fetchImpl: ctx.integrations.kapsoFetch },
        company.whatsappPhoneNumberId,
        template,
      ),
    );
  }
  return {
    ...checkResult(checks),
    formLeadPath: formLeadPath(company.slug),
  };
}
