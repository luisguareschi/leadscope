import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { setHubspotEnabled } from "./set-hubspot-enabled.service.js";

const bodySchema = z.strictObject({ enabled: z.boolean() });

export function setHubspotEnabledController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { enabled } = parseInput(bodySchema, req.body);
    res.json({ hubspot: await setHubspotEnabled(ctx, companyId, enabled) });
  };
}
