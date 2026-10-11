import type { AppContext } from "../../context.js";
import { applyStatusUpdate, recordInboundMessage } from "../../conversation/inbound.js";
import { parseWebhookPayload } from "../../integrations/whatsapp/webhook-payload.js";

/**
 * Stores every message and delivery receipt in the payload and returns the threads that need a
 * reply. Runs before the 200 goes back to Meta: if the database is down Meta retries, so nothing is lost.
 */
export async function receiveWebhook(ctx: AppContext, payload: unknown): Promise<{ threadIds: string[] }> {
  const { messages, statuses } = parseWebhookPayload(payload);
  const threadIds = new Set<string>();
  for (const message of messages) {
    const result = await recordInboundMessage(ctx, message);
    if (result.status === "recorded" && result.needsReply) threadIds.add(result.threadId);
    if (result.status === "unknown_company") {
      ctx.logger.warn({ phoneNumberId: message.phoneNumberId }, "webhook for a phone number id with no company");
    }
  }
  for (const status of statuses) await applyStatusUpdate(ctx, status);
  return { threadIds: [...threadIds] };
}
