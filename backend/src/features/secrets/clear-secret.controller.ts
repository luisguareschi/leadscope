import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { badRequest } from "../../lib/http-error.js";
import { isCompanySecretName, secretParamsSchema } from "./secret-params.js";
import { clearSecret } from "./clear-secret.service.js";

export function clearSecretController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { name } = parseInput(secretParamsSchema, req.params);
    if (!isCompanySecretName(name))
      throw badRequest("Secreto desconocido.", "invalid_input");
    res.json({ secret: await clearSecret(ctx, companyId, name) });
  };
}
