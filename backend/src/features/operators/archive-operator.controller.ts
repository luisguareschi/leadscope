import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { archiveOperator } from "./archive-operator.service.js";
import { operatorParamsSchema } from "./operator-params.js";

export function archiveOperatorController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = parseInput(
      operatorParamsSchema,
      req.params,
    );
    res.json({ operator: await archiveOperator(ctx, companyId, operatorId) });
  };
}
