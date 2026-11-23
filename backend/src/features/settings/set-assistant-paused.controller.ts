import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { setAssistantPaused } from "./set-assistant-paused.service.js";

const bodySchema = z.strictObject({ paused: z.boolean() });

export function setAssistantPausedController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, actorEmail } = companyAccessOf(req);
    const { paused } = parseInput(bodySchema, req.body);
    res.json({
      assistant: await setAssistantPaused(ctx, companyId, paused, actorEmail),
    });
  };
}
