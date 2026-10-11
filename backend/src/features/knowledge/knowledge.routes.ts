import { Router } from "express";
import type { AppContext } from "../../context.js";
import { deleteKnowledgeFileController } from "./delete-knowledge-file.controller.js";
import { getKnowledgeFileController } from "./get-knowledge-file.controller.js";
import { listKnowledgeFilesController } from "./list-knowledge-files.controller.js";
import { replaceKnowledgeFileController } from "./replace-knowledge-file.controller.js";
import { singleFileUpload } from "./upload-middleware.js";
import { uploadKnowledgeFileController } from "./upload-knowledge-file.controller.js";

export function knowledgeRoutes(ctx: AppContext): Router {
  const router = Router();
  router.get("/files", listKnowledgeFilesController(ctx));
  router.get("/files/:id", getKnowledgeFileController(ctx));
  router.post("/files", singleFileUpload, uploadKnowledgeFileController(ctx));
  router.put("/files/:id", singleFileUpload, replaceKnowledgeFileController(ctx));
  router.delete("/files/:id", deleteKnowledgeFileController(ctx));
  return router;
}
