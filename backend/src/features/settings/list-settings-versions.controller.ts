import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { listSettingsVersions } from "./list-settings-versions.service.js";

export function listSettingsVersionsController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await listSettingsVersions(ctx, companyId));
  };
}
