import { safeEqual } from "../../../lib/crypto.js";
import { MESSAGE_RECEIVED, STATUS_EVENTS } from "./kapso-webhook.js";
import {
  kapsoErrorOf,
  kapsoRequest,
  type KapsoClientOptions,
  type KapsoResponse,
} from "./kapso-api.js";

export type ConnectionCheckStatus = "ok" | "warning" | "error" | "skipped";

export type ConnectionCheck = {
  id: "phoneNumberId" | "apiKey" | "webhookSecret" | "number" | "webhook";
  status: ConnectionCheckStatus;
  /** Spanish, for the panel. */
  label: string;
  detail: string;
};

type HealthResponse = {
  status?: "healthy" | "degraded" | "unhealthy" | "error";
  error?: string | null;
  checks?: Record<
    string,
    { passed?: boolean | null; details?: Record<string, unknown> } | undefined
  > | null;
};

type KapsoWebhook = {
  url?: string;
  kind?: string;
  events?: string[];
  active?: boolean;
  secret_key?: string | null;
  payload_version?: string | null;
};

function requestFailure(response: KapsoResponse, what: string): string {
  if (response.status === 401)
    return "Kapso rechazó la clave de API. Revisá que sea una clave del proyecto donde está conectado el número.";
  if (response.status === 404)
    return "Kapso no encuentra ese Phone number ID en el proyecto de esta clave.";
  if (response.status === 429)
    return "Kapso limita estas pruebas por minuto. Probá de nuevo en un rato.";
  return `Kapso respondió ${response.status} al pedir ${what}: ${kapsoErrorOf(response).message}`;
}

const CHECK_NAMES: Record<string, string> = {
  phone_number_access: "acceso al número",
  phone_number_connection: "conexión del número",
  messaging_health: "envío de mensajes",
  webhook_subscription: "suscripción de Meta",
  webhook_verified: "verificación de Meta",
  token_validity: "token de la app de WhatsApp Business",
};

/** GET /platform/v1/whatsapp/phone_numbers/{id}/health (https://docs.kapso.ai/api/platform/v1/phone-numbers/check-phone-health). */
async function checkNumber(
  options: KapsoClientOptions,
  phoneNumberId: string,
): Promise<ConnectionCheck> {
  const label = "Número conectado en Kapso";
  let response: KapsoResponse;
  try {
    response = await kapsoRequest(
      options,
      `/platform/v1/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/health`,
      { timeoutMs: 20_000 },
    );
  } catch {
    return {
      id: "number",
      status: "error",
      label,
      detail: "No se pudo conectar con Kapso.",
    };
  }
  if (!response.ok)
    return {
      id: "number",
      status: "error",
      label,
      detail: requestFailure(response, "el estado del número"),
    };
  const health = response.json as HealthResponse;
  const access = health.checks?.phone_number_access?.details ?? {};
  const shown = [access.display_phone_number, access.verified_name]
    .filter((value): value is string => typeof value === "string" && !!value)
    .join(" · ");
  const failing = Object.entries(health.checks ?? {})
    .filter(([, check]) => check?.passed === false)
    .map(([name]) => CHECK_NAMES[name] ?? name);
  const prefix = shown ? `${shown}. ` : "";
  switch (health.status) {
    case "healthy":
      return {
        id: "number",
        status: "ok",
        label,
        detail: `${prefix}Kapso y Meta lo ven sano.`,
      };
    case "degraded":
      return {
        id: "number",
        status: "warning",
        label,
        detail: `${prefix}Funciona con limitaciones: ${failing.join(", ") || "ver el detalle en Kapso"}.`,
      };
    case "unhealthy":
      return {
        id: "number",
        status: "error",
        label,
        detail: `${prefix}No puede enviar ni recibir bien: ${failing.join(", ") || "ver el detalle en Kapso"}. Si Meta lo muestra desconectado, volvé a conectarlo en Kapso.`,
      };
    default:
      return {
        id: "number",
        status: "warning",
        label,
        detail: `Kapso no pudo completar la revisión${health.error ? `: ${health.error}` : ""}. Probá de nuevo en unos minutos.`,
      };
  }
}

/** GET /platform/v1/whatsapp/phone_numbers/{id}/webhooks (https://docs.kapso.ai/api/platform/v1/webhooks/list-webhooks). */
async function checkWebhook(
  options: KapsoClientOptions,
  input: {
    phoneNumberId: string;
    webhookPath: string;
    webhookSecret: string | undefined;
  },
): Promise<ConnectionCheck> {
  const label = "Webhook hacia LeadScope";
  const query = new URLSearchParams({
    url_contains: input.webhookPath,
    per_page: "50",
  });
  let response: KapsoResponse;
  try {
    response = await kapsoRequest(
      options,
      `/platform/v1/whatsapp/phone_numbers/${encodeURIComponent(input.phoneNumberId)}/webhooks?${query}`,
    );
  } catch {
    return {
      id: "webhook",
      status: "error",
      label,
      detail: "No se pudo conectar con Kapso.",
    };
  }
  if (!response.ok)
    return {
      id: "webhook",
      status: "error",
      label,
      detail: requestFailure(response, "los webhooks del número"),
    };
  const all = ((response.json as { data?: KapsoWebhook[] }).data ?? []).filter(
    (hook) => hook.url?.replace(/\/$/, "").endsWith(input.webhookPath),
  );
  const receiving = all.filter(
    (hook) =>
      (hook.kind ?? "kapso") === "kapso" &&
      hook.events?.includes(MESSAGE_RECEIVED),
  );
  const hook = receiving.find((item) => item.active) ?? receiving[0];
  if (!hook) {
    const metaKind = all.some((item) => item.kind === "meta");
    return {
      id: "webhook",
      status: "error",
      label,
      detail: metaKind
        ? "Hay un webhook hacia esta URL pero es de tipo Meta. Tiene que ser de tipo Kapso, con el evento whatsapp.message.received."
        : "Kapso no tiene un webhook de este número hacia la URL de esta empresa con el evento whatsapp.message.received.",
    };
  }
  if (!hook.active)
    return {
      id: "webhook",
      status: "error",
      label,
      detail:
        "El webhook está pausado en Kapso. Activalo en Kapso; si se pausó solo, es porque nuestras respuestas fallaban.",
    };
  if (hook.payload_version && hook.payload_version !== "v2")
    return {
      id: "webhook",
      status: "error",
      label,
      detail: `El webhook usa el formato ${hook.payload_version}. LeadScope lee el formato v2.`,
    };
  if (
    input.webhookSecret &&
    typeof hook.secret_key === "string" &&
    hook.secret_key &&
    !safeEqual(hook.secret_key, input.webhookSecret)
  )
    return {
      id: "webhook",
      status: "error",
      label,
      detail:
        "La clave secreta del webhook en Kapso no coincide con la guardada acá. Copiala de nuevo.",
    };
  const missingStatuses = Object.keys(STATUS_EVENTS).filter(
    (event) => !hook.events?.includes(event),
  );
  if (missingStatuses.length > 0)
    return {
      id: "webhook",
      status: "warning",
      label,
      detail: `Recibe los mensajes. Le faltan los eventos de estado (${missingStatuses.join(", ")}): sin ellos el panel no muestra si se entregó o leyó cada respuesta.`,
    };
  return {
    id: "webhook",
    status: "ok",
    label,
    detail: "Activo, formato v2, recibe mensajes y estados de entrega.",
  };
}

export async function checkKapsoConnection(
  options: KapsoClientOptions,
  input: {
    phoneNumberId: string;
    webhookPath: string;
    webhookSecret: string | undefined;
  },
): Promise<ConnectionCheck[]> {
  return Promise.all([
    checkNumber(options, input.phoneNumberId),
    checkWebhook(options, input),
  ]);
}
