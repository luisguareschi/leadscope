import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { listThreads } from "./list-threads.service.js";
import { ASSIGNEE_FILTERS, BOT_FILTERS, STAGE_FILTERS } from "./thread-dto.js";

const querySchema = z.object({
  stage: z.enum(STAGE_FILTERS).default("all"),
  bot: z.enum(BOT_FILTERS).default("all"),
  assignee: z.enum(ASSIGNEE_FILTERS).default("all"),
  search: z.string().max(100).optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function listThreadsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId, operatorId } = companyAccessOf(req);
    res.json(
      await listThreads(
        ctx,
        companyId,
        operatorId,
        parseInput(querySchema, req.query),
      ),
    );
  };
}
