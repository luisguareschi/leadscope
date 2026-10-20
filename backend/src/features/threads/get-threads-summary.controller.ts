import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { getThreadsSummary } from "./get-threads-summary.service.js";

export function getThreadsSummaryController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = companyAccessOf(req);
    res.json(await getThreadsSummary(ctx, companyId, operatorId));
  };
}
