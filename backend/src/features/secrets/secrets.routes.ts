import { Router } from "express";
import type { AppContext } from "../../context.js";
import { clearSecretController } from "./clear-secret.controller.js";
import { getSecretsController } from "./get-secrets.controller.js";
import { setSecretController } from "./set-secret.controller.js";

export function secretsRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/", getSecretsController(ctx));
  router.put("/:name", setSecretController(ctx));
  router.delete("/:name", clearSecretController(ctx));
  return router;
}
