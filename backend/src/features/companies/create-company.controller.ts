import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { panelOriginFor } from "../../http/panel-origin.js";
import { sessionOf } from "../../http/require-session.js";
import { parseInput } from "../../http/validate.js";
import { createCompanyBodySchema } from "./company-params.js";
import { createCompany } from "./create-company.service.js";

export function createCompanyController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const input = parseInput(createCompanyBodySchema, req.body);
    const panelOrigin = panelOriginFor(ctx.env, req);
    res
      .status(201)
      .json(
        await createCompany(
          ctx,
          input,
          sessionOf(req).sessionEmail,
          panelOrigin,
        ),
      );
  };
}
