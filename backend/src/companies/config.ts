import { z } from "zod";

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
    source: z.enum(["fixture", "google-sheet"]),
    fixturePath: z.string().optional(),
    sheetId: z.string().default(""),
    sheetRange: z.string().default("Sheet1!A:G"),
    columnMapping: z.object({
      slug: z.string(),
      name: z.string(),
      priceFrom: z.string(),
      typologies: z.string(),
      deliveryDate: z.string(),
      orientation: z.string(),
      notes: z.string(),
    }),
    allowlistedUrls: z
      .array(z.object({ projectSlug: z.string(), url: z.string().url() }))
      .default([]),
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
