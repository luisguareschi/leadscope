import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { companyParamsSchema } from "./company-params.js";
import { restoreCompany } from "./restore-company.service.js";

export function restoreCompanyController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = parseInput(companyParamsSchema, req.params);
    res.json({ company: await restoreCompany(ctx, companyId) });
  };
}
