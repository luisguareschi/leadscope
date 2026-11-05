import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { checkAnthropicConnection } from "./check-anthropic.service.js";

export function checkAnthropicController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await checkAnthropicConnection(ctx, companyId));
  };
}
