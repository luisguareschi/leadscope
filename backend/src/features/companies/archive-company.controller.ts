import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { archiveCompany } from "./archive-company.service.js";
import { companyParamsSchema } from "./company-params.js";

export function archiveCompanyController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = parseInput(companyParamsSchema, req.params);
    res.json({ company: await archiveCompany(ctx, companyId) });
  };
}
