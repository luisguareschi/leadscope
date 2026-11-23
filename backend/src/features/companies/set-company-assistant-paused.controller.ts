import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { sessionOf } from "../../http/require-session.js";
import { parseInput } from "../../http/validate.js";
import { companyParamsSchema } from "./company-params.js";
import { setCompanyAssistantPaused } from "./set-company-assistant-paused.service.js";

const bodySchema = z.strictObject({ paused: z.boolean() });

export function setCompanyAssistantPausedController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = parseInput(companyParamsSchema, req.params);
    const { paused } = parseInput(bodySchema, req.body);
    const actorEmail = sessionOf(req).sessionEmail;
    res.json({
      company: await setCompanyAssistantPaused(
        ctx,
        companyId,
        paused,
        actorEmail,
      ),
    });
  };
}
