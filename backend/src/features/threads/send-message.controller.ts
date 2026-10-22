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

const bodySchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(1, "Escribí un mensaje.")
    .max(
      MAX_MANUAL_MESSAGE_CHARS,
      `WhatsApp acepta hasta ${MAX_MANUAL_MESSAGE_CHARS} caracteres por mensaje.`,
    ),
});

export function sendMessageController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const access = companyAccessOf(req);
    const { id } = parseInput(threadParamsSchema, req.params);
    const { body } = parseInput(bodySchema, req.body);
    res.status(201).json(await sendManualMessage(ctx, access, id, body));
  };
}
