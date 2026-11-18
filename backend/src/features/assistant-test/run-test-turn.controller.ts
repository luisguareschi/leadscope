import type { RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../../context.js";
import { MAX_SUMMARY_CHARS } from "../../engine/turn.js";
import { companyAccessOf } from "../../http/company-access.js";
import { parseInput } from "../../http/validate.js";
import { runTestTurn } from "./run-test-turn.service.js";

/** WhatsApp's limit for one text message. */
const MAX_MESSAGE_CHARS = 4096;
const MAX_MESSAGES = 200;
/**
 * Characters across the history. The panel API also caps the JSON body at 100 KB, which accents
 * and emoji can reach first; the browser trims the whole request to fit that too.
 */
export const MAX_HISTORY_CHARS = 60_000;

const leadSchema = z.strictObject({
  state: z.enum(["greeting", "qualify", "answer", "handoff", "closed"]),
  stage: z.enum(["qualifying", "to_contact", "contacted", "not_interested"]),
  // The engine stores the model's values as they come, so any value it returned must come back.
  // The body limit is what bounds them.
  collected: z
    .record(z.string().max(64), z.string().max(MAX_HISTORY_CHARS))
    .refine((value) => Object.keys(value).length <= 10, "Hasta 10 datos."),
  callTime: z.string().max(MAX_HISTORY_CHARS).nullable(),
  summary: z.string().max(MAX_SUMMARY_CHARS).nullable(),
});

const bodySchema = z
  .strictObject({
    messages: z
      .array(
        z.strictObject({
          role: z.enum(["lead", "assistant"]),
          body: z.string().max(MAX_MESSAGE_CHARS),
        }),
      )
      .min(1, "Escribe un mensaje.")
      .max(MAX_MESSAGES, `Hasta ${MAX_MESSAGES} mensajes.`),
    lead: leadSchema.optional(),
    leadName: z.string().max(80).nullable().optional(),
  })
  .refine((body) => body.messages.at(-1)?.role === "lead", {
    message: "El último mensaje tiene que ser del lead.",
    path: ["messages"],
  })
  .refine((body) => body.messages.at(-1)?.body.trim(), {
    message: "Escribe un mensaje.",
    path: ["messages"],
  })
  .refine(
    (body) =>
      body.messages.reduce((sum, message) => sum + message.body.length, 0) <=
      MAX_HISTORY_CHARS,
    {
      message: `La conversación de prueba supera los ${MAX_HISTORY_CHARS} caracteres.`,
      path: ["messages"],
    },
  );

export function runTestTurnController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const access = companyAccessOf(req);
    const body = parseInput(bodySchema, req.body);
    res.json(await runTestTurn(ctx, access.companyId, body));
  };
}
