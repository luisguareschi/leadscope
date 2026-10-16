import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { deleteOperator } from "./delete-operator.service.js";
import { operatorParamsSchema } from "./operator-params.js";

export function deleteOperatorController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = parseInput(
      operatorParamsSchema,
      req.params,
    );
    res.json(await deleteOperator(ctx, companyId, operatorId));
  };
}
