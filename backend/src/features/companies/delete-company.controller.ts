import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import {
  companyParamsSchema,
  deleteCompanyBodySchema,
} from "./company-params.js";
import { deleteCompany } from "./delete-company.service.js";

export function deleteCompanyController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = parseInput(companyParamsSchema, req.params);
    const { confirmSlug } = parseInput(deleteCompanyBodySchema, req.body ?? {});
    res.json(await deleteCompany(ctx, companyId, confirmSlug));
  };
}
