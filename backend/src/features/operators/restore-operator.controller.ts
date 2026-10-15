import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { operatorParamsSchema } from "./operator-params.js";
import { restoreOperator } from "./restore-operator.service.js";

export function restoreOperatorController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = parseInput(
      operatorParamsSchema,
      req.params,
    );
    res.json({ operator: await restoreOperator(ctx, companyId, operatorId) });
  };
}
