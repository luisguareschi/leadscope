import { Router } from "express";
import type { AppContext } from "../../context.js";
import { createCompanyController } from "./create-company.controller.js";
import { listCompaniesController } from "./list-companies.controller.js";

export function companiesRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/", listCompaniesController(ctx));
  router.post("/", createCompanyController(ctx));
  return router;
}
