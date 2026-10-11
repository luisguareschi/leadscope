import express, { Router } from "express";
import type { AppContext } from "../../context.js";
import { createFormLeadController } from "./create-form-lead.controller.js";

export function formLeadsRoutes(ctx: AppContext): Router {
  const router = Router();
  router.post("/:companySlug", express.json({ limit: "100kb" }), createFormLeadController(ctx));
  return router;
}
