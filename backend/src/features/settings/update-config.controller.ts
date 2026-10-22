import type { RequestHandler } from "express";
import { parseSettingsInput } from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { updateConfigBodySchema } from "./settings-params.js";
import { updateConfig } from "./update-config.service.js";

export function updateConfigController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyName, whatsappPhoneNumberId, ...config } =
      parseSettingsInput(updateConfigBodySchema, req.body);
    res.json(
      await updateConfig(ctx, companyAccessOf(req), config, {
        companyName,
        whatsappPhoneNumberId,
      }),
    );
  };
}
