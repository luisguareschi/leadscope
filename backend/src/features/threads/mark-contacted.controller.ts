import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { markContacted } from "./mark-contacted.service.js";
import { threadParamsSchema } from "./thread-params.js";

export function markContactedController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const access = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    res.json({ thread: await markContacted(ctx, access, id) });
  };
}
