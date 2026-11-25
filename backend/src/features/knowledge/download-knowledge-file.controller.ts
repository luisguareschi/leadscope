import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { sendSafeStoredFile } from "../../http/safe-file-response.js";
import { parseInput } from "../../http/validate.js";
import { notFound } from "../../lib/http-error.js";
import { fileParamsSchema } from "./knowledge-params.js";

export function downloadKnowledgeFileController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id } = parseInput(fileParamsSchema, req.params);
    const file = await ctx.db.knowledgeFile.findFirst({
      where: { id, companyId },
      select: { name: true, mimeType: true, storagePath: true },
    });
    if (!file?.storagePath) {
      throw notFound("Archivo original no disponible.");
    }
    const stored = await ctx.storage.download(file.storagePath);
    sendSafeStoredFile(res, {
      data: stored.data,
      mimeType:
        file.mimeType || stored.contentType || "application/octet-stream",
      fileName: file.name,
    });
  };
}
