/**
 * Kapso's two APIs share one project API key, sent as `X-API-Key`
 * (https://docs.kapso.ai/api/introduction). The WhatsApp API mirrors Meta's Graph API under
 * `/meta/whatsapp/<version>`; the Platform API manages numbers and webhooks under `/platform/v1`.
 */
export const KAPSO_API_BASE_URL = "https://api.kapso.ai";
export const KAPSO_WHATSAPP_API_VERSION = "v24.0";

export type KapsoClientOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

export type KapsoResponse = {
  status: number;
  ok: boolean;
  json: unknown;
};

export async function kapsoRequest(
  options: KapsoClientOptions,
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; timeoutMs?: number } = {},
): Promise<KapsoResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? KAPSO_API_BASE_URL).replace(/\/$/, "");
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "X-API-Key": options.apiKey,
      ...(init.body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
  });
  const json: unknown = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, json };
}

/**
 * Kapso returns Meta-style errors (`{ error: { message, code } }`) from the WhatsApp API and
 * plain ones (`{ error: "…", code: "insufficient_credits" }`) for its own checks.
 */
export function kapsoErrorOf(response: KapsoResponse): {
  message: string;
  code?: number | string;
} {
  const json = (response.json ?? {}) as {
    error?: string | { message?: string; code?: number | string };
    code?: number | string;
    message?: string;
  };
  if (typeof json.error === "string") {
    return { message: json.error, code: json.code };
  }
  return {
    message:
      json.error?.message ??
      json.message ??
      `Kapso returned ${response.status}`,
    code: json.error?.code ?? json.code,
  };
}
