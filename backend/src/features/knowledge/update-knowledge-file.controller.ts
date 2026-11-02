import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { fileParamsSchema, folderRefSchema } from "./knowledge-params.js";
import { updateKnowledgeFile } from "./update-knowledge-file.service.js";

const bodySchema = z.strictObject({
  name: z.string().max(400).optional(),
  folderId: folderRefSchema.optional(),
});

export function updateKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(fileParamsSchema, req.params);
    const change = parseInput(bodySchema, req.body);
    res.json(await updateKnowledgeFile(ctx, companyId, id, change));
  };
}
