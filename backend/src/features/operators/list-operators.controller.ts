import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { listOperators } from "./list-operators.service.js";
import { companyOperatorsParamsSchema } from "./operator-params.js";

export function listOperatorsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = parseInput(companyOperatorsParamsSchema, req.params);
    res.json({ operators: await listOperators(ctx, companyId) });
  };
}
