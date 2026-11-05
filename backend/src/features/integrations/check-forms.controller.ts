import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { checkFormsConnection } from "./check-forms.service.js";

export function checkFormsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await checkFormsConnection(ctx, companyId));
  };
}
