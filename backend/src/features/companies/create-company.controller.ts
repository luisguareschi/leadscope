import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { createCompanyBodySchema } from "./company-params.js";
import { createCompany } from "./create-company.service.js";

export function createCompanyController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const input = parseInput(createCompanyBodySchema, req.body);
    const company = await createCompany(ctx, input);
    res.status(201).json({ company });
  };
}
