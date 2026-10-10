import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { operatorOf } from "../../http/require-operator.js";
import { parseInput } from "../../http/validate.js";
import { fileParamsSchema } from "./knowledge-params.js";
import { replaceKnowledgeFile } from "./replace-knowledge-file.service.js";

export function replaceKnowledgeFileController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { id } = parseInput(fileParamsSchema, req.params);
    res.json(await replaceKnowledgeFile(ctx, operatorOf(req), id, req.file));
  };
}
