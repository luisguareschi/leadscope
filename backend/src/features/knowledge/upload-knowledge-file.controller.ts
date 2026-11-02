import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { uploadKnowledgeFile } from "./upload-knowledge-file.service.js";

/** Multipart text field next to the file. Missing or empty uploads to the root. */
const bodySchema = z.object({
  folderId: z
    .string()
    .max(64)
    .optional()
    .transform((value) => value || null),
});

export function uploadKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { folderId } = parseInput(bodySchema, req.body ?? {});
    const result = await uploadKnowledgeFile(
      ctx,
      companyAccessOf(req),
      folderId,
      req.file,
    );
    res.status(result.replaced ? 200 : 201).json(result);
  };
}
