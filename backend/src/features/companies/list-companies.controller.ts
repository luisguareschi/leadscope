import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { listCompanies } from "./list-companies.service.js";

export function listCompaniesController(ctx: AppContext): RequestHandler {
  return async (_req, res) => {
    res.json({ companies: await listCompanies(ctx) });
  };
}
