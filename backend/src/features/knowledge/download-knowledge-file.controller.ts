import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
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
    res.setHeader(
      "Content-Type",
      file.mimeType || stored.contentType || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.name)}"`,
    );
    res.send(stored.data);
  };
}
