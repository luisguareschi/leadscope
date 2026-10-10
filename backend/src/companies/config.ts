import { z } from "zod";
import { KNOWLEDGE_MAX_COMPANY_BYTES, KNOWLEDGE_MAX_FILE_BYTES } from "./knowledge-limits";

export const companyConfigSchema = z.object({
  displayName: z.string().min(1),
  language: z.string().min(1),
  tone: z.string().min(1),
  brandVoice: z.string().default(""),
  questions: z.array(z.string().min(1)).min(1),
  forbiddenTopics: z.array(z.string()).default([]),
  businessHours: z.string().default(""),
  messages: z
    .object({
      fallback: z.string().default("Te va a contactar un asesor."),
      nonText: z.string().default("¿Me lo podés escribir? Así te ayudo."),
      maxReplyChars: z.number().int().positive().default(500),
    })
    .default({}),
  knowledge: z.object({
    /** Extracted text of one file. Defaults keep a company prompt small. */
    maxFileBytes: z.number().int().positive().default(KNOWLEDGE_MAX_FILE_BYTES),
    maxCompanyBytes: z.number().int().positive().default(KNOWLEDGE_MAX_COMPANY_BYTES),
    /** Optional public pages. Secondary to uploaded files. Not fetched in v1. */
    allowlistedUrls: z.array(z.string().url()).default([]),
  }),
  crm: z.object({
    adapter: z.literal("hubspot"),
    /** HubSpot internal name of the long text property. Empty until week 1. */
    transcriptProperty: z.string().default(""),
  }),
  whatsapp: z.object({
    phoneNumberId: z.string().min(1),
    welcomeTemplateName: z.string().default(""),
    templateLanguage: z.string().default("es"),
  }),
});

export type CompanyConfig = z.infer<typeof companyConfigSchema>;

export function parseCompanyConfig(value: unknown): CompanyConfig {
  return companyConfigSchema.parse(value);
}
