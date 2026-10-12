import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { uploadKnowledgeFile } from "./upload-knowledge-file.service.js";

export function uploadKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const result = await uploadKnowledgeFile(
      ctx,
      companyAccessOf(req),
      req.file,
    );
    res.status(result.replaced ? 200 : 201).json(result);
  };
}
