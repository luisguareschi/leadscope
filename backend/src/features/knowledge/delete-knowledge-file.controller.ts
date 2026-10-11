import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { deleteKnowledgeFile } from "./delete-knowledge-file.service.js";
import { fileParamsSchema } from "./knowledge-params.js";

export function deleteKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    const { id } = parseInput(fileParamsSchema, req.params);
    await deleteKnowledgeFile(ctx, companyId, id);
    res.status(204).end();
  };
}
