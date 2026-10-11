import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { verifyWebhookSubscription } from "./verify-webhook.service.js";

export function verifyWebhookController(ctx: AppContext): RequestHandler {
  return (req, res) => {
    const text = (value: unknown) => (typeof value === "string" ? value : undefined);
    const challenge = verifyWebhookSubscription(ctx, {
      mode: text(req.query["hub.mode"]),
      token: text(req.query["hub.verify_token"]),
      challenge: text(req.query["hub.challenge"]),
    });
    if (challenge) res.status(200).type("text/plain").send(challenge);
    else res.status(403).send("forbidden");
  };
}
