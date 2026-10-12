import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { getPromptPreview } from "./get-prompt-preview.service.js";

export function getPromptPreviewController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const { companyId } = companyAccessOf(req);
    res.json(await getPromptPreview(ctx, companyId));
  };
}
