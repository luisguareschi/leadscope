import { Router } from "express";
import type { AppContext } from "../../context.js";
import { requirePlatformAdmin } from "../../http/platform-admin.js";
import { getCompaniesMetricsController } from "./get-companies-metrics.controller.js";
import { getMetricsController } from "./get-metrics.controller.js";

export function metricsRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get(
    "/companies",
    requirePlatformAdmin(ctx),
    getCompaniesMetricsController(ctx),
  );
  router.get("/", getMetricsController(ctx));
  return router;
}
