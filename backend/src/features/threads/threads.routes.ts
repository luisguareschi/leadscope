import { Router } from "express";
import type { AppContext } from "../../context.js";
import { clearNeedsHumanController } from "./clear-needs-human.controller.js";
import { deleteThreadController } from "./delete-thread.controller.js";
import { getThreadController } from "./get-thread.controller.js";
import { getThreadsSummaryController } from "./get-threads-summary.controller.js";
import { listThreadsController } from "./list-threads.controller.js";
import { pauseThreadController } from "./pause-thread.controller.js";
import { resumeThreadController } from "./resume-thread.controller.js";
import { retryCrmSyncController } from "./retry-crm-sync.controller.js";

export function threadsRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/", listThreadsController(ctx));
  router.get("/summary", getThreadsSummaryController(ctx));
  router.get("/:id", getThreadController(ctx));
  router.post("/:id/pause", pauseThreadController(ctx));
  router.post("/:id/resume", resumeThreadController(ctx));
  router.post("/:id/clear-needs-human", clearNeedsHumanController(ctx));
  router.post("/:id/crm-sync", retryCrmSyncController(ctx));
  router.delete("/:id", deleteThreadController(ctx));
  return router;
}
