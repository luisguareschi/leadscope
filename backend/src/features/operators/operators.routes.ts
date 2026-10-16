import { Router } from "express";
import type { AppContext } from "../../context.js";
import { addOperatorController } from "./add-operator.controller.js";
import { archiveOperatorController } from "./archive-operator.controller.js";
import { deleteOperatorController } from "./delete-operator.controller.js";
import { listOperatorsController } from "./list-operators.controller.js";
import { resendInviteController } from "./resend-invite.controller.js";
import { restoreOperatorController } from "./restore-operator.controller.js";

/** Mounted at `/companies/:companyId/operators`, for platform admins only. */
export function operatorsRoutes(ctx: AppContext): Router {
  const router = Router({ mergeParams: true });
  router.get("/", listOperatorsController(ctx));
  router.post("/", addOperatorController(ctx));
  router.post("/:operatorId/invite", resendInviteController(ctx));
  router.post("/:operatorId/archive", archiveOperatorController(ctx));
  router.post("/:operatorId/restore", restoreOperatorController(ctx));
  router.delete("/:operatorId", deleteOperatorController(ctx));
  return router;
}
