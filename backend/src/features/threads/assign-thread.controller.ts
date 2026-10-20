import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { assignThread } from "./assign-thread.service.js";
import { threadParamsSchema } from "./thread-params.js";

const bodySchema = z.strictObject({
  operatorId: z.string().min(1).max(64).nullable(),
});

export function assignThreadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    const { operatorId } = parseInput(bodySchema, req.body);
    res.json({ thread: await assignThread(ctx, companyId, id, operatorId) });
  };
}
