import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { clearNeedsHuman } from "./clear-needs-human.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function clearNeedsHumanController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    res.json({ thread: await clearNeedsHuman(ctx, companyId, id) });
  };
}
