import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { getKnowledgeFile } from "./get-knowledge-file.service.js";
import { fileParamsSchema } from "./knowledge-params.js";

export function getKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(fileParamsSchema, req.params);
    res.json(await getKnowledgeFile(ctx, companyId, id));
  };
}
