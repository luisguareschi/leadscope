import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { panelOriginFor } from "../../http/panel-origin.js";
import { parseInput } from "../../http/validate.js";
import { operatorParamsSchema } from "./operator-params.js";
import { resendInvite } from "./resend-invite.service.js";

export function resendInviteController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = parseInput(
      operatorParamsSchema,
      req.params,
    );
    const panelOrigin = panelOriginFor(ctx.env, req);
    res.json(await resendInvite(ctx, companyId, operatorId, panelOrigin));
  };
}
