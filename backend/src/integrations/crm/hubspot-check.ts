import type { IntegrationCheck } from "../integration-check.js";
import { HubSpotError } from "./hubspot.js";

const API = "https://api.hubapi.com";

/** What LeadScope does with the token: search, create, and update contacts and read the property. */
export const HUBSPOT_REQUIRED_SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
] as const;

export type HubspotAccount = { portalId: string; uiDomain: string };

/** HubSpot's own UI hosts: app.hubspot.com, app-eu1.hubspot.com, app-na2.hubspot.com, … */
const UI_DOMAIN = /^app(-[a-z0-9]+)?\.hubspot\.com$/;

/**
 * The contact's record in HubSpot: `https://<uiDomain>/contacts/<portalId>/record/0-1/<contactId>`
 * (0-1 is HubSpot's object type id for contacts). Null when anything is missing or unexpected, so
 * the panel never links somewhere else.
 */
export function hubspotRecordUrl(
  account: { portalId: string | null; uiDomain: string | null },
  contactId: string | null,
): string | null {
  const { portalId, uiDomain } = account;
  if (!portalId || !uiDomain || !contactId) return null;
  if (!/^\d+$/.test(portalId) || !/^\d+$/.test(contactId)) return null;
  if (!UI_DOMAIN.test(uiDomain)) return null;
  return `https://${uiDomain}/contacts/${portalId}/record/0-1/${contactId}`;
}

type Response = { status: number; ok: boolean; json: Record<string, unknown> };

async function call(
  fetchImpl: typeof fetch,
  token: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<Response> {
  const response = await fetchImpl(`${API}${path}`, {
    method,
    headers: {
      // HubSpot needs the bearer header to route EU tokens even on the token-info call.
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  return { status: response.status, ok: response.ok, json };
}

function accountOf(json: Record<string, unknown>): HubspotAccount | null {
  const { portalId, uiDomain } = json;
  if (
    (typeof portalId !== "number" && typeof portalId !== "string") ||
    typeof uiDomain !== "string"
  )
    return null;
  return { portalId: String(portalId), uiDomain };
}

/**
 * GET /account-info/v3/details: the account's id (`portalId`) and UI host (`uiDomain`). Null only
 * when HubSpot rejects the token (401); any other failure throws, so a stored account survives it.
 */
export async function fetchHubspotAccount(
  fetchImpl: typeof fetch,
  token: string,
): Promise<HubspotAccount | null> {
  const response = await call(
    fetchImpl,
    token,
    "GET",
    "/account-info/v3/details",
  );
  if (response.status === 401) return null;
  const account = response.ok ? accountOf(response.json) : null;
  if (!account)
    throw new HubSpotError(
      `HubSpot account info returned ${response.status}`,
      response.status,
    );
  return account;
}

function failure(response: Response, what: string): string {
  if (response.status === 401)
    return "HubSpot rechazó el token. Copia de nuevo el token de acceso de la app privada.";
  if (response.status === 403) return `El token no tiene permiso para ${what}.`;
  if (response.status === 429)
    return "HubSpot limita las pruebas por minuto. Prueba de nuevo en un rato.";
  const message =
    typeof response.json.message === "string"
      ? `: ${response.json.message}`
      : "";
  return `HubSpot respondió ${response.status} al pedir ${what}${message}.`;
}

const UNREACHABLE = "No se pudo conectar con HubSpot.";

export type HubspotCheckResult = {
  checks: IntegrationCheck[];
  /** Set when the token reached the account; the caller saves it on the company. */
  account: HubspotAccount | null;
  /** HubSpot answered 401: the stored account is no longer this token's. */
  tokenRejected: boolean;
};

/**
 * Configuración → HubSpot → Probar conexión. Only reads: the account, the token's scopes, and the
 * long-text property. Nothing is created or changed in HubSpot.
 */
export async function checkHubspot(
  fetchImpl: typeof fetch,
  token: string,
  transcriptProperty: string,
): Promise<HubspotCheckResult> {
  const tokenLabel = "Token de HubSpot";
  let accountResponse: Response;
  try {
    accountResponse = await call(
      fetchImpl,
      token,
      "GET",
      "/account-info/v3/details",
    );
  } catch {
    return {
      account: null,
      tokenRejected: false,
      checks: [
        {
          id: "token",
          status: "error",
          label: tokenLabel,
          detail: UNREACHABLE,
        },
      ],
    };
  }
  if (!accountResponse.ok)
    return {
      account: null,
      tokenRejected: accountResponse.status === 401,
      checks: [
        {
          id: "token",
          status: "error",
          label: tokenLabel,
          detail: failure(accountResponse, "los datos de la cuenta"),
        },
        {
          id: "scopes",
          status: "skipped",
          label: "Permisos",
          detail: "Se prueban cuando el token sea válido.",
        },
        {
          id: "property",
          status: "skipped",
          label: "Propiedad del resumen",
          detail: "Se prueba cuando el token sea válido.",
        },
      ],
    };
  const account = accountOf(accountResponse.json);
  const { portalName } = accountResponse.json;
  const named =
    typeof portalName === "string" && portalName ? `${portalName}, ` : "";
  const checks: IntegrationCheck[] = [
    {
      id: "token",
      status: "ok",
      label: tokenLabel,
      detail: account
        ? `Válido. Cuenta ${named}ID ${account.portalId} (${account.uiDomain}).`
        : "Válido.",
    },
  ];

  try {
    const info = await call(
      fetchImpl,
      token,
      "POST",
      "/oauth/v2/private-apps/get/access-token-info",
      { tokenKey: token },
    );
    const scopes = Array.isArray(info.json.scopes)
      ? (info.json.scopes as unknown[]).filter(
          (scope): scope is string => typeof scope === "string",
        )
      : null;
    if (!info.ok || !scopes) {
      checks.push({
        id: "scopes",
        status: "warning",
        label: "Permisos",
        detail:
          "HubSpot no devolvió los permisos de este token (solo lo hace con tokens de apps privadas). Revisa a mano que tenga crm.objects.contacts.read y crm.objects.contacts.write.",
      });
    } else {
      const missing = HUBSPOT_REQUIRED_SCOPES.filter(
        (scope) => !scopes.includes(scope),
      );
      checks.push(
        missing.length === 0
          ? {
              id: "scopes",
              status: "ok",
              label: "Permisos",
              detail: `Tiene ${HUBSPOT_REQUIRED_SCOPES.join(" y ")}.`,
            }
          : {
              id: "scopes",
              status: "error",
              label: "Permisos",
              detail: `Le falta ${missing.join(" y ")}. Agrégalo en la app privada de HubSpot, en Alcances (Scopes), y guarda los cambios.`,
            },
      );
    }
  } catch {
    checks.push({
      id: "scopes",
      status: "error",
      label: "Permisos",
      detail: UNREACHABLE,
    });
  }

  checks.push(await checkProperty(fetchImpl, token, transcriptProperty));
  return { account, tokenRejected: false, checks };
}

/** GET /crm/v3/properties/contacts/{name}: the property exists and is multi-line text. */
async function checkProperty(
  fetchImpl: typeof fetch,
  token: string,
  name: string,
): Promise<IntegrationCheck> {
  const label = "Propiedad del resumen";
  if (!name)
    return {
      id: "property",
      status: "warning",
      label,
      detail:
        "Sin propiedad, solo se crea o actualiza el contacto, sin el resumen ni la conversación. Créala en HubSpot y escribe aquí su nombre interno.",
    };
  let response: Response;
  try {
    response = await call(
      fetchImpl,
      token,
      "GET",
      `/crm/v3/properties/contacts/${encodeURIComponent(name)}`,
    );
  } catch {
    return { id: "property", status: "error", label, detail: UNREACHABLE };
  }
  if (response.status === 404)
    return {
      id: "property",
      status: "error",
      label,
      detail: `No existe una propiedad de contacto con el nombre interno ${name}. Créala en HubSpot (Texto de varias líneas) o corrige el nombre.`,
    };
  if (!response.ok)
    return {
      id: "property",
      status: "error",
      label,
      detail: failure(response, "la propiedad"),
    };
  const { type, fieldType, label: shown } = response.json;
  if (type !== "string")
    return {
      id: "property",
      status: "error",
      label,
      detail: `La propiedad ${name} no es de texto (es de tipo ${String(type)}). Tiene que ser Texto de varias líneas.`,
    };
  const title = typeof shown === "string" && shown ? `«${shown}» ` : "";
  return fieldType === "textarea"
    ? {
        id: "property",
        status: "ok",
        label,
        detail: `${title}(${name}) existe y es de texto de varias líneas.`,
      }
    : {
        id: "property",
        status: "warning",
        label,
        detail: `${title}(${name}) existe, pero es de una sola línea. Funciona, aunque en HubSpot se lee mejor como Texto de varias líneas.`,
      };
}
