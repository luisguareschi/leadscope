import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { folderParamsSchema, folderRefSchema } from "./knowledge-params.js";
import { updateKnowledgeFolder } from "./update-knowledge-folder.service.js";

const bodySchema = z.strictObject({
  name: z.string().max(400).optional(),
  parentId: folderRefSchema.optional(),
});

export function updateKnowledgeFolderController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(folderParamsSchema, req.params);
    const change = parseInput(bodySchema, req.body);
    res.json(await updateKnowledgeFolder(ctx, companyId, id, change));
  };
}
