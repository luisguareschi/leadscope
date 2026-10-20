import { z } from "zod";

/** Hard ceiling for any upload. A company's own `knowledge.maxFileBytes` cannot go above it. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const DEFAULT_KNOWLEDGE_LIMITS = {
  /** Raw upload size. PDFs with images are large even when their text is small. */
  maxFileBytes: 15 * 1024 * 1024,
  /** Extracted text per file, about 15k tokens. */
  maxCharsPerFile: 60_000,
  /** Extracted text across all files, about 40k tokens of prompt. */
  maxCharsTotal: 150_000,
};

/** How many items a company can ask the assistant to find out. */
export const MAX_COLLECT_ITEMS = 10;

const collectItemSchema = z.object({
  /** Stable id: the key in `Thread.collected` and in submit_turn's `collected`. */
  key: z.string().min(1),
  /** Short label for the panel and the CRM summary, e.g. "Presupuesto". */
  name: z.string().min(1),
  /** What to find out, for the prompt. Not a question to read out. */
  description: z.string().default(""),
  /** Handoff waits for every required item. */
  required: z.boolean().default(true),
});

export type CollectItem = z.infer<typeof collectItemSchema>;

/** The three items every company had before the list was configurable, keyed as the old columns. */
const LEGACY_COLLECT = [
  { key: "interest", name: "Interés" },
  { key: "budget", name: "Presupuesto" },
  { key: "knowsProjects", name: "Conoce los proyectos" },
] as const;

/**
 * Configs saved before Oct 2026 had three fixed `questions` and regex `forbiddenTopics.patterns`.
 * Turns that shape into today's: the three questions become three required items with the same
 * keys (their wording becomes the description), and the patterns are dropped. A current config
 * comes back unchanged. The SQL migration does the same to stored rows.
 */
export function upgradeLegacyConfig(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const config = { ...(value as Record<string, unknown>) };
  if (!("collect" in config) && config.questions) {
    const questions = config.questions as Record<string, unknown>;
    config.collect = LEGACY_COLLECT.map((item) => ({
      ...item,
      description:
        typeof questions[item.key] === "string" ? questions[item.key] : "",
      required: true,
    }));
  }
  delete config.questions;
  const forbidden = config.forbiddenTopics;
  if (forbidden && typeof forbidden === "object" && "patterns" in forbidden) {
    const { patterns: _patterns, ...rest } = forbidden as Record<
      string,
      unknown
    >;
    config.forbiddenTopics = rest;
  }
  return config;
}

const configShape = z.object({
  displayName: z.string().min(1),
  /** BCP 47 language of the conversation, e.g. "es-UY". */
  language: z.string().min(1),
  /** How the assistant writes, in the company's own words. */
  tone: z.string().min(1),
  timezone: z.string().default("America/Montevideo"),
  /** ISO country used to read phone numbers typed without a country code. */
  defaultCountry: z.string().length(2).default("UY"),
  businessHours: z.string().default(""),
  /** What the assistant finds out from the lead, in its own words and order. */
  collect: z.array(collectItemSchema).min(1),
  forbiddenTopics: z
    .object({
      /**
       * Plain-language list given to the model. When the model flags one (submit_turn's
       * `forbiddenTopic`), the engine sends `messages.needsHuman` instead of the model's reply.
       */
      describe: z.array(z.string().min(1)).default([]),
    })
    .default({ describe: [] }),
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
    .default({
      model: "claude-haiku-4-5",
      temperature: 0.4,
      historyLimit: 40,
      timeoutMs: 25_000,
    }),
  knowledge: z
    .object({
      maxFileBytes: z
        .number()
        .int()
        .positive()
        .default(DEFAULT_KNOWLEDGE_LIMITS.maxFileBytes),
      maxCharsPerFile: z
        .number()
        .int()
        .positive()
        .default(DEFAULT_KNOWLEDGE_LIMITS.maxCharsPerFile),
      maxCharsTotal: z
        .number()
        .int()
        .positive()
        .default(DEFAULT_KNOWLEDGE_LIMITS.maxCharsTotal),
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

export const companyConfigSchema = z.preprocess(
  upgradeLegacyConfig,
  configShape,
);

export type CompanyConfig = z.infer<typeof configShape>;
export type CompanyConfigInput = z.input<typeof configShape>;

export function parseCompanyConfig(value: unknown): CompanyConfig {
  return companyConfigSchema.parse(value);
}
