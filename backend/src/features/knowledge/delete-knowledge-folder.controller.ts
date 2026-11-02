import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { deleteKnowledgeFolder } from "./delete-knowledge-folder.service.js";
import { folderParamsSchema } from "./knowledge-params.js";

export function deleteKnowledgeFolderController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(folderParamsSchema, req.params);
    res.json(await deleteKnowledgeFolder(ctx, companyId, id));
  };
}
