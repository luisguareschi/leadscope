import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { sendSafeStoredFile } from "../../http/safe-file-response.js";
import { parseInput } from "../../http/validate.js";
import { notFound } from "../../lib/http-error.js";

const paramsSchema = z.object({
  id: z.string().min(1).max(64),
  messageId: z.string().min(1).max(64),
});

export function downloadMessageMediaController(
  ctx: AppContext,
): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    const { id: threadId, messageId } = parseInput(paramsSchema, req.params);
    const message = await ctx.db.message.findFirst({
      where: { id: messageId, threadId, companyId },
      select: { mediaPath: true, mediaMimeType: true, mediaFileName: true },
    });
    if (!message?.mediaPath) {
      throw notFound("Archivo adjunto no disponible.");
    }
    const stored = await ctx.storage.download(message.mediaPath);
    sendSafeStoredFile(res, {
      data: stored.data,
      mimeType:
        message.mediaMimeType ||
        stored.contentType ||
        "application/octet-stream",
      fileName: message.mediaFileName,
    });
  };
}
