import { Router } from "express";
import type { AppContext } from "../../context.js";
import { getMeController } from "./get-me.controller.js";

export function meRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/", getMeController(ctx));
  return router;
}
