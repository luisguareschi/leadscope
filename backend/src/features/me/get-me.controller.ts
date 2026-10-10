import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { getMe } from "./get-me.service.js";

export function getMeController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    res.json(await getMe(ctx, operatorOf(req)));
  };
}
