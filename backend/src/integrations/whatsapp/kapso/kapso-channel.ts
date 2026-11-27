import type { SupportedImageMediaType } from "../../../engine/history.js";
import {
  ChannelError,
  type Channel,
  type WhatsAppRecipient,
} from "../channel.js";
import {
  KAPSO_API_BASE_URL,
  KAPSO_WHATSAPP_API_VERSION,
  kapsoErrorOf,
  kapsoRequest,
  type KapsoClientOptions,
} from "./kapso-api.js";

type KapsoChannelOptions = KapsoClientOptions & {
  /** Meta's Phone number ID; Kapso uses the same id. */
  phoneNumberId: string;
};

/** Max inbound image size accepted for Claude Vision (Anthropic's limit is 5 MB). */
export const MAX_INBOUND_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MEDIA_HOST_SUFFIXES = [
  "kapso.ai",
  "whatsapp.net",
  "fbcdn.net",
  "fbsbx.com",
  "r2.cloudflarestorage.com",
  "amazonaws.com",
  "googleapis.com",
];

function isAllowedMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_MEDIA_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * Validates an inbound media URL to prevent SSRF and API key exfiltration:
 * - Requires HTTPS (unless matching the configured `baseUrl` origin in tests).
 * - Forbids embedded credentials (`user:pass@host`).
 * - Restricts hosts to `baseUrl` or known Kapso/WhatsApp/Meta media CDNs.
 * - Sends `X-API-Key` ONLY to the exact `baseUrl` origin.
 */
export function parseAllowedMediaUrl(
  rawUrl: string,
  baseUrl: string,
): { url: string; sendApiKey: boolean } | null {
  let parsed: URL;
  let base: URL;
  try {
    parsed = new URL(rawUrl);
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;
  const sameOrigin = parsed.origin === base.origin;
  if (sameOrigin) {
    return { url: parsed.toString(), sendApiKey: true };
  }
  if (parsed.protocol !== "https:") return null;
  if (!isAllowedMediaHost(parsed.hostname)) return null;
  return { url: parsed.toString(), sendApiKey: false };
}

async function readResponseBounded(
  response: Response,
  maxBytes: number,
): Promise<Buffer | null> {
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > 0 && buffer.length <= maxBytes ? buffer : null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) return null;
  return Buffer.concat(chunks, total);
}

const SUPPORTED_VISION_MIME: Record<string, SupportedImageMediaType> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/gif": "image/gif",
  "image/webp": "image/webp",
};

export function normalizeVisionMimeType(
  raw: string | null | undefined,
): SupportedImageMediaType | null {
  if (!raw) return null;
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return SUPPORTED_VISION_MIME[base] ?? null;
}

/**
 * Downloads an inbound WhatsApp media binary through Kapso (either a direct `media_url` from the
 * webhook or Meta's media lookup `/meta/whatsapp/<v>/<mediaId>`). Best-effort: returns null if
 * disallowed, unavailable, or above `maxBytes`.
 */
export async function downloadKapsoMedia(
  options: KapsoClientOptions & {
    mediaUrl?: string | null;
    mediaId?: string | null;
    maxBytes?: number;
    timeoutMs?: number;
  },
): Promise<{ data: Buffer; mimeType: string } | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? KAPSO_API_BASE_URL).replace(/\/$/, "");
  const maxBytes = options.maxBytes ?? MAX_INBOUND_IMAGE_BYTES;
  const timeoutMs = options.timeoutMs ?? 5_000;

  let downloadUrl = options.mediaUrl?.trim() || null;
  if (!downloadUrl && options.mediaId) {
    const meta = await kapsoRequest(
      options,
      `/meta/whatsapp/${KAPSO_WHATSAPP_API_VERSION}/${encodeURIComponent(options.mediaId)}`,
      { method: "GET", timeoutMs: Math.min(timeoutMs, 4_000) },
    );
    if (!meta.ok) return null;
    const url = (meta.json as { url?: unknown })?.url;
    if (typeof url === "string" && url.trim()) downloadUrl = url.trim();
  }
  if (!downloadUrl) return null;

  const target = parseAllowedMediaUrl(downloadUrl, baseUrl);
  if (!target) return null;

  const response = await fetchImpl(target.url, {
    method: "GET",
    headers:
      target.sendApiKey && options.apiKey
        ? { "X-API-Key": options.apiKey }
        : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) return null;
  const buffer = await readResponseBounded(response, maxBytes);
  if (!buffer) return null;
  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";
  return { data: buffer, mimeType };
}

/**
 * Sends through Kapso's WhatsApp API, which takes Meta's Cloud API body unchanged:
 * https://docs.kapso.ai/api/meta/whatsapp/messages/send-a-message
 */
export function createKapsoChannel(options: KapsoChannelOptions): Channel {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? KAPSO_API_BASE_URL).replace(/\/$/, "");
  const phonePath = `/meta/whatsapp/${KAPSO_WHATSAPP_API_VERSION}/${encodeURIComponent(options.phoneNumberId)}`;
  const path = `${phonePath}/messages`;

  async function post(
    body: Record<string, unknown>,
  ): Promise<{ messages?: Array<{ id?: string }> }> {
    const response = await kapsoRequest(options, path, {
      method: "POST",
      body: { messaging_product: "whatsapp", ...body },
    });
    if (!response.ok) {
      const { message, code } = kapsoErrorOf(response);
      throw new ChannelError(message, code, response.status);
    }
    return response.json as { messages?: Array<{ id?: string }> };
  }

  async function uploadMedia(
    data: Buffer,
    mimeType: string,
    fileName: string,
  ): Promise<string> {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append(
      "file",
      new Blob([new Uint8Array(data)], {
        type: mimeType || "application/octet-stream",
      }),
      fileName,
    );
    const response = await fetchImpl(`${baseUrl}${phonePath}/media`, {
      method: "POST",
      headers: { "X-API-Key": options.apiKey },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    const json: unknown = await response.json().catch(() => ({}));
    if (!response.ok) {
      const { message, code } = kapsoErrorOf({
        status: response.status,
        ok: false,
        json,
      });
      throw new ChannelError(message, code, response.status);
    }
    const id = (json as { id?: unknown })?.id;
    if (typeof id !== "string" || !id) {
      throw new ChannelError("Kapso media upload response had no media id");
    }
    return id;
  }

  function messageIdOf(json: { messages?: Array<{ id?: string }> }): string {
    const id = json.messages?.[0]?.id;
    if (!id) throw new ChannelError("Kapso response had no message id");
    return id;
  }

  function targetFields(target: WhatsAppRecipient): Record<string, string> {
    return target.to !== undefined
      ? { to: target.to }
      : { recipient: target.recipient };
  }

  return {
    kind: "kapso",
    async sendText(input) {
      const json = await post({
        recipient_type: "individual",
        ...targetFields(input),
        type: "text",
        text: { preview_url: false, body: input.body },
      });
      return { waMessageId: messageIdOf(json) };
    },
    async sendTemplate(input) {
      const json = await post({
        recipient_type: "individual",
        ...targetFields(input),
        type: "template",
        template: { name: input.name, language: { code: input.language } },
      });
      return { waMessageId: messageIdOf(json) };
    },
    async sendMedia(input) {
      const mediaId = await uploadMedia(
        input.data,
        input.mimeType,
        input.fileName,
      );
      const captionTrimmed = input.caption?.trim();
      const payload =
        input.kind === "image"
          ? {
              recipient_type: "individual",
              ...targetFields(input),
              type: "image",
              image: {
                id: mediaId,
                ...(captionTrimmed ? { caption: captionTrimmed } : {}),
              },
            }
          : {
              recipient_type: "individual",
              ...targetFields(input),
              type: "document",
              document: {
                id: mediaId,
                filename: input.fileName,
                ...(captionTrimmed ? { caption: captionTrimmed } : {}),
              },
            };
      const json = await post(payload);
      return { waMessageId: messageIdOf(json) };
    },
    // https://docs.kapso.ai/docs/whatsapp/send-messages/mark-read
    async markReadWithTyping(waMessageId) {
      await post({
        status: "read",
        message_id: waMessageId,
        typing_indicator: { type: "text" },
      }).catch(() => undefined);
    },
  };
}
