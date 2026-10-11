import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { resumeThread } from "./resume-thread.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function resumeThreadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    res.json({ thread: await resumeThread(ctx, companyId, id) });
  };
}
