import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { getThread } from "./get-thread.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function getThreadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    res.json(await getThread(ctx, companyId, id));
  };
}
