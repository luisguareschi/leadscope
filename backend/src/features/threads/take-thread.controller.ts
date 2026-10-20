import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { takeThread } from "./take-thread.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function takeThreadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    res.json({ thread: await takeThread(ctx, companyId, id, operatorId) });
  };
}
