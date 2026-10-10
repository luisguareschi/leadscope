import { z } from "zod";

export const DEFAULT_KNOWLEDGE_LIMITS = {
  /** Raw upload size. PDFs with images are large even when their text is small. */
  maxFileBytes: 15 * 1024 * 1024,
  /** Extracted text per file, about 15k tokens. */
  maxCharsPerFile: 60_000,
  /** Extracted text across all files, about 40k tokens of prompt. */
  maxCharsTotal: 150_000,
};

export const companyConfigSchema = z.object({
  displayName: z.string().min(1),
  /** BCP 47 language of the conversation, e.g. "es-UY". */
  language: z.string().min(1),
  /** How the assistant writes, in the company's own words. */
  tone: z.string().min(1),
  /** Extra context about the company the assistant can rely on. */
  about: z.string().default(""),
  timezone: z.string().default("America/Montevideo"),
  /** ISO country used to read phone numbers typed without a country code. */
  defaultCountry: z.string().length(2).default("UY"),
  businessHours: z.string().default(""),
  /** Wording of the three qualifying questions. The fields themselves are fixed by the engine. */
  questions: z.object({
    interest: z.string().min(1),
    budget: z.string().min(1),
    knowsProjects: z.string().min(1),
  }),
  forbiddenTopics: z
    .object({
      /** Plain-language list given to the model. */
      describe: z.array(z.string().min(1)).default([]),
      /** Case-insensitive regular expressions checked on every reply before it is sent. */
      patterns: z.array(z.string().min(1)).default([]),
    })
    .default({ describe: [], patterns: [] }),
  messages: z.object({
    /** Sent when the model fails or a reply is blocked. The bot then waits for a human. */
    fallback: z.string().min(1),
    /** Sent when the lead asks for something only a person can handle. The bot then waits for a human. */
    needsHuman: z.string().min(1),
    /** Sent when the lead only sends audio, images, or stickers. */
    nonText: z.string().min(1),
  }),
  maxReplyChars: z.number().int().min(80).max(4096).default(600),
  llm: z
    .object({
      model: z.string().default("claude-haiku-4-5"),
      temperature: z.number().min(0).max(1).default(0.4),
      historyLimit: z.number().int().min(4).max(200).default(40),
      timeoutMs: z.number().int().min(1000).default(25_000),
    })
    .default({ model: "claude-haiku-4-5", temperature: 0.4, historyLimit: 40, timeoutMs: 25_000 }),
  knowledge: z
    .object({
      maxFileBytes: z.number().int().positive().default(DEFAULT_KNOWLEDGE_LIMITS.maxFileBytes),
      maxCharsPerFile: z.number().int().positive().default(DEFAULT_KNOWLEDGE_LIMITS.maxCharsPerFile),
      maxCharsTotal: z.number().int().positive().default(DEFAULT_KNOWLEDGE_LIMITS.maxCharsTotal),
    })
    .default(DEFAULT_KNOWLEDGE_LIMITS),
  crm: z
    .object({
      provider: z.literal("hubspot").default("hubspot"),
      /** Internal name of the HubSpot long-text property that receives the summary. Empty until it exists. */
      transcriptProperty: z.string().default(""),
    })
    .default({ provider: "hubspot", transcriptProperty: "" }),
  whatsapp: z
    .object({
      /** Approved template sent to leads who arrive from a form. Null until Meta approves one. */
      welcomeTemplate: z
        .object({
          name: z.string().min(1),
          language: z.string().min(1),
          /** The approved text, so the transcript and the model see what the lead received. */
          bodyPreview: z.string().default(""),
        })
        .nullable()
        .default(null),
    })
    .default({ welcomeTemplate: null }),
});

export type CompanyConfig = z.infer<typeof companyConfigSchema>;
export type CompanyConfigInput = z.input<typeof companyConfigSchema>;

export function parseCompanyConfig(value: unknown): CompanyConfig {
  return companyConfigSchema.parse(value);
}
