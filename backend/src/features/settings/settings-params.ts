import { z } from "zod";
import { MAX_INSTRUCTIONS_CHARS } from "../../companies/editable-config.js";

/** Platform rules are code, so `instructions` is the only field this route accepts. */
export const updateInstructionsBodySchema = z.strictObject({
  instructions: z
    .string()
    .trim()
    .max(
      MAX_INSTRUCTIONS_CHARS,
      `Máximo ${new Intl.NumberFormat("es-UY").format(MAX_INSTRUCTIONS_CHARS)} caracteres.`,
    ),
});

export const versionParamsSchema = z.object({ id: z.string().min(1).max(64) });
