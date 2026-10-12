import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { resolveCompanyAccess } from "../../http/company-access.js";
import { sessionOf } from "../../http/require-session.js";
import { getMe } from "./get-me.service.js";

export function getMeController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    res.json(
      await getMe(ctx, sessionOf(req), await resolveCompanyAccess(ctx, req)),
    );
  };
}
