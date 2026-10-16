import { Router } from "express";
import type { AppContext } from "../../context.js";
import { getPromptPreviewController } from "./get-prompt-preview.controller.js";
import { getSettingsController } from "./get-settings.controller.js";
import { getSettingsOptionsController } from "./get-settings-options.controller.js";
import { listSettingsVersionsController } from "./list-settings-versions.controller.js";
import { restoreSettingsVersionController } from "./restore-settings-version.controller.js";
import { updateConfigController } from "./update-config.controller.js";
import { updateInstructionsController } from "./update-instructions.controller.js";

export function settingsRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/", getSettingsController(ctx));
  router.put("/config", updateConfigController(ctx));
  router.put("/instructions", updateInstructionsController(ctx));
  router.get("/versions", listSettingsVersionsController(ctx));
  router.post("/versions/:id/restore", restoreSettingsVersionController(ctx));
  router.get("/prompt", getPromptPreviewController(ctx));
  router.get("/options", getSettingsOptionsController(ctx));
  return router;
}
