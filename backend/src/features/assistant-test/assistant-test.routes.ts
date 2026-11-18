import { Router } from "express";
import type { AppContext } from "../../context.js";
import { runTestTurnController } from "./run-test-turn.controller.js";

export function assistantTestRoutes(ctx: AppContext): Router {
  const router = Router();
  router.post("/turn", runTestTurnController(ctx));
  return router;
}
