import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { listAssignees } from "./list-assignees.service.js";

export function listAssigneesController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = companyAccessOf(req);
    res.json(await listAssignees(ctx, companyId, operatorId));
  };
}
