import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import {
  MAX_MANUAL_MESSAGE_CHARS,
  sendManualMessage,
} from "./send-message.service.js";
import { threadParamsSchema } from "./thread-params.js";

const jsonBodySchema = z
  .strictObject({
    body: z
      .string()
      .trim()
      .max(
        MAX_MANUAL_MESSAGE_CHARS,
        `WhatsApp acepta hasta ${MAX_MANUAL_MESSAGE_CHARS} caracteres por mensaje.`,
      )
      .optional(),
    knowledgeFileId: z.string().trim().min(1).max(64).optional(),
  })
  .refine((data) => Boolean(data.body?.trim() || data.knowledgeFileId), {
    message: "Escribe un mensaje.",
    path: ["body"],
  });

const multipartBodySchema = z.object({
  body: z
    .string()
    .trim()
    .max(
      MAX_MANUAL_MESSAGE_CHARS,
      `WhatsApp acepta hasta ${MAX_MANUAL_MESSAGE_CHARS} caracteres por mensaje.`,
    )
    .optional(),
});

export function sendMessageController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const access = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    if (req.file) {
      const { body } = parseInput(multipartBodySchema, req.body ?? {});
      res
        .status(201)
        .json(
          await sendManualMessage(ctx, access, id, { body, file: req.file }),
        );
      return;
    }
    const { body, knowledgeFileId } = parseInput(
      jsonBodySchema,
      req.body ?? {},
    );
    res
      .status(201)
      .json(
        await sendManualMessage(ctx, access, id, { body, knowledgeFileId }),
      );
  };
}
