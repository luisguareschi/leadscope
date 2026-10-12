import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { pauseThread } from "./pause-thread.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function pauseThreadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    res.json({ thread: await pauseThread(ctx, companyId, id) });
  };
}
