import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { uploadKnowledgeFile } from "./upload-knowledge-file.service.js";

/** Multipart text fields next to the file. Missing or empty folderId uploads to the root. */
const bodySchema = z.object({
  folderId: z
    .string()
    .max(64)
    .optional()
    .transform((value) => value || null),
  visibility: z.enum(["internal", "public"]).optional(),
  description: z.string().max(300).optional(),
});

export function uploadKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { folderId, visibility, description } = parseInput(
      bodySchema,
      req.body ?? {},
    );
    const result = await uploadKnowledgeFile(
      ctx,
      companyAccessOf(req),
      folderId,
      req.file,
      { visibility, description },
    );
    res.status(result.replaced ? 200 : 201).json(result);
  };
}
