import { z } from "zod";
import {
  companyNameSchema,
  editableConfigSchema,
  MAX_INSTRUCTIONS_CHARS,
  whatsappPhoneNumberIdSchema,
} from "../../companies/editable-config.js";

/**
 * The Asistente sections save the config, the company's name, and the WhatsApp phone number id
 * together. The name and the id are optional: leaving one out keeps the stored one.
 */
export const updateConfigBodySchema = editableConfigSchema.extend({
  companyName: companyNameSchema.optional(),
  whatsappPhoneNumberId: whatsappPhoneNumberIdSchema.optional(),
});

/** A stored name checked on restore, reported under the same field as in the form. */
export const companyNameValueSchema = z.object({
  companyName: companyNameSchema,
});

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

/** A stored id checked on restore, reported under the same field as in the form. */
export const whatsappPhoneNumberIdValueSchema = z.object({
  whatsappPhoneNumberId: whatsappPhoneNumberIdSchema,
});

export const versionParamsSchema = z.object({ id: z.string().min(1).max(64) });
