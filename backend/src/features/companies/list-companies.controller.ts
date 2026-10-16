import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { listCompaniesQuerySchema } from "./company-params.js";
import { listCompanies } from "./list-companies.service.js";

export function listCompaniesController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { status } = parseInput(listCompaniesQuerySchema, req.query);
    res.json({ companies: await listCompanies(ctx, status) });
  };
}
