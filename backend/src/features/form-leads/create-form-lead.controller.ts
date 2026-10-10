import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { createFormLead } from "./create-form-lead.service.js";

const paramsSchema = z.object({ companySlug: z.string().min(1).max(64) });

export function createFormLeadController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companySlug } = parseInput(paramsSchema, req.params);
    const bearer = req.header("authorization")?.replace(/^Bearer\s+/i, "");
    const result = await createFormLead(ctx, {
      companySlug,
      secret: req.header("x-leadscope-secret") ?? bearer,
      body: req.body,
    });
    res.status(200).json(result);
  };
}
