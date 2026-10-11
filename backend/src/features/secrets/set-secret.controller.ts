import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { badRequest } from "../../lib/http-error.js";
import { isCompanySecretName, secretParamsSchema, setSecretBodySchema } from "./secret-params.js";
import { setSecret } from "./set-secret.service.js";

export function setSecretController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    const { name } = parseInput(secretParamsSchema, req.params);
    if (!isCompanySecretName(name)) throw badRequest("Secreto desconocido.", "invalid_input");
    const { value } = parseInput(setSecretBodySchema, req.body);
    res.json({ secret: await setSecret(ctx, companyId, name, value) });
  };
}
