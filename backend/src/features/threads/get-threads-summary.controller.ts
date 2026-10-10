import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { getThreadsSummary } from "./get-threads-summary.service.js";

export function getThreadsSummaryController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    res.json(await getThreadsSummary(ctx, companyId));
  };
}
