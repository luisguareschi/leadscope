import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { checkHubspotConnection } from "./check-hubspot.service.js";

export function checkHubspotController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await checkHubspotConnection(ctx, companyId));
  };
}
