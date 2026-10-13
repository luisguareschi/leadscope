import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { listKnowledgeFiles } from "./list-knowledge-files.service.js";

export function listKnowledgeFilesController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await listKnowledgeFiles(ctx, companyId));
  };
}
