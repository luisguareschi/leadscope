import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { getKnowledgeFile } from "./get-knowledge-file.service.js";
import { fileParamsSchema } from "./knowledge-params.js";

export function getKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    const { id } = parseInput(fileParamsSchema, req.params);
    res.json(await getKnowledgeFile(ctx, companyId, id));
  };
}
