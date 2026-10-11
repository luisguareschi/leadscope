import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { getSecrets } from "./get-secrets.service.js";

export function getSecretsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    res.json(await getSecrets(ctx, companyId));
  };
}
