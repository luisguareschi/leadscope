import type { RequestHandler } from "express";
import { parseSettingsInput } from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { updateInstructionsBodySchema } from "./settings-params.js";
import { updateInstructions } from "./update-instructions.service.js";

export function updateInstructionsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { instructions } = parseSettingsInput(
      updateInstructionsBodySchema,
      req.body,
    );
    res.json(await updateInstructions(ctx, companyAccessOf(req), instructions));
  };
}
