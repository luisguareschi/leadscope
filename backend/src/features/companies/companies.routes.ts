import { Router } from "express";
import type { AppContext } from "../../context.js";
import { auditCompanyWrites } from "../../http/admin-audit.js";
import { operatorsRoutes } from "../operators/operators.routes.js";
import { archiveCompanyController } from "./archive-company.controller.js";
import { createCompanyController } from "./create-company.controller.js";
import { deleteCompanyController } from "./delete-company.controller.js";
import { listCompaniesController } from "./list-companies.controller.js";
import { restoreCompanyController } from "./restore-company.controller.js";

export function companiesRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/", listCompaniesController(ctx));
  router.post("/", createCompanyController(ctx));
  router.use("/:companyId", auditCompanyWrites(ctx));
  router.post("/:companyId/archive", archiveCompanyController(ctx));
  router.post("/:companyId/restore", restoreCompanyController(ctx));
  router.delete("/:companyId", deleteCompanyController(ctx));
  router.use("/:companyId/operators", operatorsRoutes(ctx));
  return router;
}
