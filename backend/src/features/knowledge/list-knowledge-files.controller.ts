import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { listKnowledgeFiles } from "./list-knowledge-files.service.js";

export function listKnowledgeFilesController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = operatorOf(req);
    res.json(await listKnowledgeFiles(ctx, companyId));
  };
}
