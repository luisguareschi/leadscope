import express, { Router } from "express";
import type { AppContext } from "../../context.js";
import { receiveWebhookController } from "./receive-webhook.controller.js";
import { verifyWebhookController } from "./verify-webhook.controller.js";

export function whatsappWebhookRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/", verifyWebhookController(ctx));
  // The signature covers the exact bytes Meta sent, so the body stays raw until it is verified.
  router.post("/", express.raw({ type: "*/*", limit: "1mb" }), receiveWebhookController(ctx));
  return router;
}
