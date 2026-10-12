import type { CompanyConfig } from "@/lib/types";

const MEGABYTE = 1024 * 1024;

/** The config as the form edits it: numbers and lists are strings until they are saved. */
export type ConfigDraft = {
  displayName: string;
  language: string;
  timezone: string;
  defaultCountry: string;
  businessHours: string;
  tone: string;
  maxReplyChars: string;
  interest: string;
  budget: string;
  knowsProjects: string;
  forbiddenDescribe: string;
  forbiddenPatterns: string;
  needsHuman: string;
  fallback: string;
  nonText: string;
  welcomeEnabled: boolean;
  templateName: string;
  templateLanguage: string;
  templateBody: string;
  transcriptProperty: string;
  model: string;
  temperature: string;
  historyLimit: string;
  timeoutSeconds: string;
  maxFileMegabytes: string;
  maxCharsPerFile: string;
  maxCharsTotal: string;
};

/** Where the API reports each form field's error. */
export const FIELD_PATHS: Record<keyof ConfigDraft, string> = {
  displayName: "displayName",
  language: "language",
  timezone: "timezone",
  defaultCountry: "defaultCountry",
  businessHours: "businessHours",
  tone: "tone",
  maxReplyChars: "maxReplyChars",
  interest: "questions.interest",
  budget: "questions.budget",
  knowsProjects: "questions.knowsProjects",
  forbiddenDescribe: "forbiddenTopics.describe",
  forbiddenPatterns: "forbiddenTopics.patterns",
  needsHuman: "messages.needsHuman",
  fallback: "messages.fallback",
  nonText: "messages.nonText",
  welcomeEnabled: "whatsapp.welcomeTemplate",
  templateName: "whatsapp.welcomeTemplate.name",
  templateLanguage: "whatsapp.welcomeTemplate.language",
  templateBody: "whatsapp.welcomeTemplate.bodyPreview",
  transcriptProperty: "crm.transcriptProperty",
  model: "llm.model",
  temperature: "llm.temperature",
  historyLimit: "llm.historyLimit",
  timeoutSeconds: "llm.timeoutMs",
  maxFileMegabytes: "knowledge.maxFileBytes",
  maxCharsPerFile: "knowledge.maxCharsPerFile",
  maxCharsTotal: "knowledge.maxCharsTotal",
};

export function errorsByField(
  fields: Record<string, string>,
): Partial<Record<keyof ConfigDraft, string>> {
  const errors: Partial<Record<keyof ConfigDraft, string>> = {};
  for (const [key, path] of Object.entries(FIELD_PATHS)) {
    if (fields[path]) errors[key as keyof ConfigDraft] = fields[path];
  }
  return errors;
}

const lines = (values: string[]) => values.join("\n");
const fromLines = (value: string) =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
/** An empty or unreadable number is sent as null, so the API says which field to complete. */
const toNumber = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value.trim().replace(",", "."));
const round = (value: number) => Math.round(value * 100) / 100;

export function toDraft(config: CompanyConfig): ConfigDraft {
  const template = config.whatsapp.welcomeTemplate;
  return {
    displayName: config.displayName,
    language: config.language,
    timezone: config.timezone,
    defaultCountry: config.defaultCountry,
    businessHours: config.businessHours,
    tone: config.tone,
    maxReplyChars: String(config.maxReplyChars),
    interest: config.questions.interest,
    budget: config.questions.budget,
    knowsProjects: config.questions.knowsProjects,
    forbiddenDescribe: lines(config.forbiddenTopics.describe),
    forbiddenPatterns: lines(config.forbiddenTopics.patterns),
    needsHuman: config.messages.needsHuman,
    fallback: config.messages.fallback,
    nonText: config.messages.nonText,
    welcomeEnabled: template !== null,
    templateName: template?.name ?? "",
    templateLanguage: template?.language ?? "es",
    templateBody: template?.bodyPreview ?? "",
    transcriptProperty: config.crm.transcriptProperty,
    model: config.llm.model,
    temperature: String(config.llm.temperature),
    historyLimit: String(config.llm.historyLimit),
    timeoutSeconds: String(round(config.llm.timeoutMs / 1000)),
    maxFileMegabytes: String(round(config.knowledge.maxFileBytes / MEGABYTE)),
    maxCharsPerFile: String(config.knowledge.maxCharsPerFile),
    maxCharsTotal: String(config.knowledge.maxCharsTotal),
  };
}

export function fromDraft(draft: ConfigDraft): CompanyConfig {
  return {
    displayName: draft.displayName,
    language: draft.language,
    tone: draft.tone,
    timezone: draft.timezone,
    defaultCountry: draft.defaultCountry,
    businessHours: draft.businessHours,
    questions: {
      interest: draft.interest,
      budget: draft.budget,
      knowsProjects: draft.knowsProjects,
    },
    forbiddenTopics: {
      describe: fromLines(draft.forbiddenDescribe),
      patterns: fromLines(draft.forbiddenPatterns),
    },
    messages: {
      fallback: draft.fallback,
      needsHuman: draft.needsHuman,
      nonText: draft.nonText,
    },
    maxReplyChars: toNumber(draft.maxReplyChars),
    llm: {
      model: draft.model,
      temperature: toNumber(draft.temperature),
      historyLimit: toNumber(draft.historyLimit),
      timeoutMs: Math.round(toNumber(draft.timeoutSeconds) * 1000),
    },
    knowledge: {
      maxFileBytes: Math.round(toNumber(draft.maxFileMegabytes) * MEGABYTE),
      maxCharsPerFile: toNumber(draft.maxCharsPerFile),
      maxCharsTotal: toNumber(draft.maxCharsTotal),
    },
    crm: { provider: "hubspot", transcriptProperty: draft.transcriptProperty },
    whatsapp: {
      welcomeTemplate: draft.welcomeEnabled
        ? {
            name: draft.templateName,
            language: draft.templateLanguage,
            bodyPreview: draft.templateBody,
          }
        : null,
    },
  };
}
