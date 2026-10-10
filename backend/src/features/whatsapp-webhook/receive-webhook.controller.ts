import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { isValidWebhookSignature } from "../../integrations/whatsapp/signature.js";
import { receiveWebhook } from "./receive-webhook.service.js";

export function receiveWebhookController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!isValidWebhookSignature(raw, req.header("x-hub-signature-256"), ctx.env.META_APP_SECRET)) {
      res.status(401).json({ error: { code: "invalid_signature", message: "invalid signature" } });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString("utf8"));
    } catch {
      res.status(400).json({ error: { code: "invalid_json", message: "invalid json" } });
      return;
    }
    const { threadIds } = await receiveWebhook(ctx, payload);
    res.status(200).json({ ok: true });
    for (const threadId of threadIds) ctx.replies.schedule(threadId);
  };
}
