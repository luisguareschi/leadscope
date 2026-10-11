import type { AppContext } from "../../context.js";
import { safeEqual } from "../../lib/crypto.js";

/** Meta's subscription handshake: echo the challenge when the verify token matches. */
export function verifyWebhookSubscription(
  ctx: AppContext,
  query: { mode?: string; token?: string; challenge?: string },
): string | null {
  const tokenMatches = query.token !== undefined && safeEqual(query.token, ctx.env.META_WEBHOOK_VERIFY_TOKEN);
  return query.mode === "subscribe" && tokenMatches && query.challenge ? query.challenge : null;
}
