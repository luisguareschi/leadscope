import express, { Router } from "express";
import type { AppContext } from "../../context.js";
import { receiveKapsoWebhookController } from "./receive-kapso-webhook.controller.js";

export function kapsoWebhookRoutes(ctx: AppContext): Router {
  const router = Router();
  // The signature covers the exact bytes Kapso sent, so the body stays raw until it is verified.
  router.post(
    "/:companySlug",
    express.raw({ type: "*/*", limit: "1mb" }),
    receiveKapsoWebhookController(ctx),
  );
  return router;
}
