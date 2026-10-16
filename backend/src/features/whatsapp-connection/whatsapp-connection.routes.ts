import { Router } from "express";
import type { AppContext } from "../../context.js";
import { checkWhatsappConnectionController } from "./check-whatsapp-connection.controller.js";

export function whatsappConnectionRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/connection-check", checkWhatsappConnectionController(ctx));
  return router;
}
