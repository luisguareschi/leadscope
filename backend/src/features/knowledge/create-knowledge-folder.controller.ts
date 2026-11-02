import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { createKnowledgeFolder } from "./create-knowledge-folder.service.js";
import { folderRefSchema } from "./knowledge-params.js";

const bodySchema = z.strictObject({
  name: z.string().max(400),
  parentId: folderRefSchema.default(null),
});

export function createKnowledgeFolderController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const input = parseInput(bodySchema, req.body);
    res.status(201).json(await createKnowledgeFolder(ctx, companyId, input));
  };
}
