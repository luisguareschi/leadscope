import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { panelOriginFor } from "../../http/panel-origin.js";
import { parseInput } from "../../http/validate.js";
import { addOperator } from "./add-operator.service.js";
import {
  addOperatorBodySchema,
  companyOperatorsParamsSchema,
} from "./operator-params.js";

export function addOperatorController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = parseInput(companyOperatorsParamsSchema, req.params);
    const { email } = parseInput(addOperatorBodySchema, req.body);
    const panelOrigin = panelOriginFor(ctx.env, req);
    res.status(201).json(await addOperator(ctx, companyId, email, panelOrigin));
  };
}
