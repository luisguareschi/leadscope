import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { parseInput } from "../../http/validate.js";
import { operatorParamsSchema } from "./operator-params.js";
import { resendInvite } from "./resend-invite.service.js";

export function resendInviteController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = parseInput(
      operatorParamsSchema,
      req.params,
    );
    res.json(await resendInvite(ctx, companyId, operatorId));
  };
}
