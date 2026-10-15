import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { getSettingsOptions } from "./get-settings-options.service.js";

export function getSettingsOptionsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await getSettingsOptions(ctx, companyId));
  };
}
