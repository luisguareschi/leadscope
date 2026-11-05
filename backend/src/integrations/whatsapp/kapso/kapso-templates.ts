import type { IntegrationCheck } from "../../integration-check.js";
import {
  KAPSO_WHATSAPP_API_VERSION,
  kapsoErrorOf,
  kapsoRequest,
  type KapsoClientOptions,
  type KapsoResponse,
} from "./kapso-api.js";

type KapsoTemplate = { name?: string; language?: string; status?: string };

const LABEL = "Plantilla de bienvenida";

function failure(response: KapsoResponse, what: string): string {
  if (response.status === 401)
    return "Kapso rechazó la clave de API. Revísala en WhatsApp (Kapso).";
  if (response.status === 404)
    return "Kapso no encuentra el número de esta empresa. Revisa el Phone number ID en WhatsApp (Kapso).";
  if (response.status === 429)
    return "Kapso limita estas pruebas por minuto. Prueba de nuevo en un rato.";
  return `Kapso respondió ${response.status} al pedir ${what}: ${kapsoErrorOf(response).message}`;
}

const STATUS_TEXT: Record<string, string> = {
  PENDING: "está en revisión en Meta",
  REJECTED: "fue rechazada por Meta",
  PAUSED: "está pausada por Meta",
  DISABLED: "está desactivada por Meta",
};

/**
 * Looks the welcome template up in the number's WhatsApp Business Account through Kapso. Only
 * reads: Get phone number (`/platform/v1/whatsapp/phone_numbers/{id}`) gives the account id, then
 * List message templates (`/meta/whatsapp/<v>/{waba}/message_templates?name=`). Nothing is sent.
 */
export async function checkWelcomeTemplate(
  options: KapsoClientOptions,
  phoneNumberId: string,
  template: { name: string; language: string },
): Promise<IntegrationCheck> {
  let number: KapsoResponse;
  try {
    number = await kapsoRequest(
      options,
      `/platform/v1/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}`,
    );
  } catch {
    return {
      id: "template",
      status: "error",
      label: LABEL,
      detail: "No se pudo conectar con Kapso.",
    };
  }
  if (!number.ok)
    return {
      id: "template",
      status: "error",
      label: LABEL,
      detail: failure(number, "el número"),
    };
  const waba = (number.json as { data?: { business_account_id?: unknown } })
    .data?.business_account_id;
  if (typeof waba !== "string" || !waba)
    return {
      id: "template",
      status: "error",
      label: LABEL,
      detail:
        "Kapso no informa la cuenta de WhatsApp Business de este número, así que no se pueden leer sus plantillas.",
    };

  let listed: KapsoResponse;
  try {
    const query = new URLSearchParams({ name: template.name, limit: "100" });
    listed = await kapsoRequest(
      options,
      `/meta/whatsapp/${KAPSO_WHATSAPP_API_VERSION}/${encodeURIComponent(waba)}/message_templates?${query}`,
    );
  } catch {
    return {
      id: "template",
      status: "error",
      label: LABEL,
      detail: "No se pudo conectar con Kapso.",
    };
  }
  if (!listed.ok)
    return {
      id: "template",
      status: "error",
      label: LABEL,
      detail: failure(listed, "las plantillas"),
    };
  const sameName = (
    (listed.json as { data?: KapsoTemplate[] }).data ?? []
  ).filter((item) => item.name === template.name);
  const match = sameName.find((item) => item.language === template.language);
  if (!match) {
    const languages = sameName
      .map((item) => item.language)
      .filter((value): value is string => Boolean(value));
    return {
      id: "template",
      status: "error",
      label: LABEL,
      detail: languages.length
        ? `${template.name} existe en ${languages.join(", ")}, pero no en ${template.language}. Corrige el idioma de la plantilla.`
        : `No hay una plantilla ${template.name} en la cuenta de WhatsApp de este número. Revisa el nombre exacto en Kapso o en Meta.`,
    };
  }
  if (match.status !== "APPROVED")
    return {
      id: "template",
      status: "error",
      label: LABEL,
      detail: match.status
        ? `${template.name} (${template.language}) ${STATUS_TEXT[match.status] ?? `tiene el estado ${match.status}`}. Solo se puede enviar una plantilla aprobada.`
        : `Kapso no informa si ${template.name} (${template.language}) está aprobada. Revísala en Kapso o en Meta y prueba de nuevo.`,
    };
  return {
    id: "template",
    status: "ok",
    label: LABEL,
    detail: `${template.name} (${template.language}) está aprobada en Meta.`,
  };
}
