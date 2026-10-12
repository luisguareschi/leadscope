import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { restoreSettingsVersion } from "./restore-settings-version.service.js";
import { versionParamsSchema } from "./settings-params.js";

export function restoreSettingsVersionController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { id } = parseInput(versionParamsSchema, req.params);
    res.json(await restoreSettingsVersion(ctx, companyAccessOf(req), id));
  };
}
