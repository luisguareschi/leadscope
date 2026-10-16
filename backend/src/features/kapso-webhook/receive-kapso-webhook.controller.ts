import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { KAPSO_SIGNATURE_HEADER } from "../../integrations/whatsapp/kapso/kapso-signature.js";
import { KAPSO_EVENT_HEADER } from "../../integrations/whatsapp/kapso/kapso-webhook.js";
import { receiveKapsoWebhook } from "./receive-kapso-webhook.service.js";

const paramsSchema = z.object({ companySlug: z.string().min(1).max(64) });

export function receiveKapsoWebhookController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companySlug } = parseInput(paramsSchema, req.params);
    const { threadIds } = await receiveKapsoWebhook(ctx, {
      companySlug,
      rawBody: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
      signature: req.header(KAPSO_SIGNATURE_HEADER),
      event: req.header(KAPSO_EVENT_HEADER),
    });
    res.status(200).json({ ok: true });
    for (const threadId of threadIds) ctx.replies.schedule(threadId);
  };
}
