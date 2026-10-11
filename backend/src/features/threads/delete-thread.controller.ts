import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { deleteThread } from "./delete-thread.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function deleteThreadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    await deleteThread(ctx, companyId, id);
    res.status(204).end();
  };
}
