import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { checkWhatsappConnection } from "./check-whatsapp-connection.service.js";

export function checkWhatsappConnectionController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await checkWhatsappConnection(ctx, companyId));
  };
}
