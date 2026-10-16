import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Kapso signs the exact request body with the webhook's secret key: `X-Webhook-Signature` is the
 * hex HMAC-SHA256, with no `sha256=` prefix (https://docs.kapso.ai/docs/platform/webhooks/security).
 */
export const KAPSO_SIGNATURE_HEADER = "x-webhook-signature";

export function signKapsoWebhook(
  rawBody: Buffer | string,
  secret: string,
): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function isValidKapsoSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
): boolean {
  if (typeof header !== "string" || !header) return false;
  const expected = Buffer.from(signKapsoWebhook(rawBody, secret), "utf8");
  const received = Buffer.from(header.trim().toLowerCase(), "utf8");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
