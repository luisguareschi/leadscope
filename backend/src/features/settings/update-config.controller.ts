import type { RequestHandler } from "express";
import { parseEditableConfig } from "../../companies/editable-config.js";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { updateConfig } from "./update-config.service.js";

export function updateConfigController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const config = parseEditableConfig(req.body);
    res.json(await updateConfig(ctx, companyAccessOf(req), config));
  };
}
