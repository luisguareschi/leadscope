import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { getThread } from "./get-thread.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function getThreadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    res.json(await getThread(ctx, companyId, id));
  };
}
