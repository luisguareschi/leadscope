import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { listThreads } from "./list-threads.service.js";

const querySchema = z.object({
  status: z.enum(["all", "active", "handoff", "needs_human", "paused", "closed"]).default("all"),
  search: z.string().max(100).optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function listThreadsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    res.json(await listThreads(ctx, companyId, parseInput(querySchema, req.query)));
  };
}
