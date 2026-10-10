import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { uploadKnowledgeFile } from "./upload-knowledge-file.service.js";

export function uploadKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const result = await uploadKnowledgeFile(ctx, operatorOf(req), req.file);
    res.status(result.replaced ? 200 : 201).json(result);
  };
}
