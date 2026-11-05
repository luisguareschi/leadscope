import { Router } from "express";
import type { AppContext } from "../../context.js";
import { checkAnthropicController } from "./check-anthropic.controller.js";
import { checkFormsController } from "./check-forms.controller.js";
import { checkHubspotController } from "./check-hubspot.controller.js";
import { setHubspotEnabledController } from "./set-hubspot-enabled.controller.js";

/**
 * Configuración → Integraciones. The checks are POST because the HubSpot one saves the account it
 * finds, and so every check made through support access is audited like a write.
 */
export function integrationsRoutes(ctx: AppContext): Router {
  const router = Router();
  router.put("/hubspot", setHubspotEnabledController(ctx));
  router.post("/hubspot/check", checkHubspotController(ctx));
  router.post("/anthropic/check", checkAnthropicController(ctx));
  router.post("/forms/check", checkFormsController(ctx));
  return router;
}
