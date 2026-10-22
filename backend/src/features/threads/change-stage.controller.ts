import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { changeThreadStage } from "./change-stage.service.js";
import { threadParamsSchema } from "./thread-params.js";

const bodySchema = z.strictObject({
  stage: z.enum(["qualifying", "to_contact", "contacted", "not_interested"]),
});

export function changeStageController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const access = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    const { stage } = parseInput(bodySchema, req.body);
    res.json({ thread: await changeThreadStage(ctx, access, id, stage) });
  };
}
