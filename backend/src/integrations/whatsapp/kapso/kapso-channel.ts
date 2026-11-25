import type { SupportedImageMediaType } from "../../../engine/history.js";
import { ChannelError, type Channel } from "../channel.js";
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
 * unavailable or above `maxBytes`.
 */
export async function downloadKapsoMedia(
  options: KapsoClientOptions & {
    mediaUrl?: string | null;
    mediaId?: string | null;
    maxBytes?: number;
  },
): Promise<{ data: Buffer; mimeType: string } | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = (options.baseUrl ?? KAPSO_API_BASE_URL).replace(/\/$/, "");
  const maxBytes = options.maxBytes ?? MAX_INBOUND_IMAGE_BYTES;

  let downloadUrl = options.mediaUrl?.trim() || null;
  if (!downloadUrl && options.mediaId) {
    const meta = await kapsoRequest(
      options,
      `/meta/whatsapp/${KAPSO_WHATSAPP_API_VERSION}/${encodeURIComponent(options.mediaId)}`,
      { method: "GET", timeoutMs: 8_000 },
    );
    if (!meta.ok) return null;
    const url = (meta.json as { url?: unknown })?.url;
    if (typeof url === "string" && url.trim()) downloadUrl = url.trim();
  }
  if (!downloadUrl) return null;

  const isKapsoHost =
    downloadUrl.startsWith(baseUrl) ||
    /^https:\/\/[^/]*kapso\.ai\//i.test(downloadUrl);
  const response = await fetchImpl(downloadUrl, {
    method: "GET",
    headers: isKapsoHost ? { "X-API-Key": options.apiKey } : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > maxBytes) return null;
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

  return {
    kind: "kapso",
    async sendText({ to, body }) {
      const json = await post({
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: false, body },
      });
      return { waMessageId: messageIdOf(json) };
    },
    async sendTemplate({ to, name, language }) {
      const json = await post({
        recipient_type: "individual",
        to,
        type: "template",
        template: { name, language: { code: language } },
      });
      return { waMessageId: messageIdOf(json) };
    },
    async sendMedia({ to, kind, data, mimeType, fileName, caption }) {
      const mediaId = await uploadMedia(data, mimeType, fileName);
      const captionTrimmed = caption?.trim();
      const payload =
        kind === "image"
          ? {
              recipient_type: "individual",
              to,
              type: "image",
              image: {
                id: mediaId,
                ...(captionTrimmed ? { caption: captionTrimmed } : {}),
              },
            }
          : {
              recipient_type: "individual",
              to,
              type: "document",
              document: {
                id: mediaId,
                filename: fileName,
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
