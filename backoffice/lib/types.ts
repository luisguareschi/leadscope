export type ThreadState =
  "greeting" | "qualify" | "answer" | "handoff" | "closed";
export type ThreadStatusFilter =
  "all" | "active" | "handoff" | "needs_human" | "paused" | "closed";
export type CrmStatus = "none" | "pending" | "synced" | "failed";

export type Thread = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  source: "whatsapp" | "form";
  state: ThreadState;
  paused: boolean;
  pausedAt: string | null;
  needsHuman: boolean;
  needsHumanReason: string | null;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  replyWindowClosesAt: string | null;
  crm: {
    status: CrmStatus;
    contactId: string | null;
    syncedAt: string | null;
    lastError: string | null;
    retriesExhausted: boolean;
  };
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  direction: "inbound" | "outbound";
  type: string;
  body: string;
  status: string | null;
  sentAt: string;
};

export type ThreadsPage = { threads: Thread[]; nextCursor: string | null };

export type ThreadsSummary = {
  total: number;
  active: number;
  handoff: number;
  needs_human: number;
  paused: number;
  closed: number;
};

export type KnowledgeFile = {
  id: string;
  name: string;
  format: string;
  formatLabel: string;
  sizeBytes: number;
  charCount: number;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeList = {
  files: KnowledgeFile[];
  usage: {
    usedChars: number;
    maxFileBytes: number;
    maxCharsPerFile: number;
    maxCharsTotal: number;
  };
  acceptedExtensions: string[];
};

export type Me = {
  operator: { email: string } | null;
  /** The company the panel works in: the operator's own, or the one a platform admin entered. */
  company: { name: string; slug: string } | null;
  platformAdmin: boolean;
  /** A platform admin entered this company from Empresas. */
  supportAccess: boolean;
};

export type CompanySummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  operators: { email: string }[];
};

export type CompaniesList = { companies: CompanySummary[] };

export type CreateCompanyInput = {
  name: string;
  slug: string;
  operatorEmail: string;
};

export type SecretName =
  | "anthropicApiKey"
  | "metaAccessToken"
  | "hubspotAccessToken"
  | "formLeadSecret";

/** Write-only status. `last4` is absent when showing it would reveal the whole secret. */
export type SecretStatus = {
  name: SecretName;
  set: boolean;
  last4: string | null;
};

export type SecretsList = { secrets: SecretStatus[] };

/** Mirrors the backend's `CompanyConfig` (companies/company-config.ts). */
export type CompanyConfig = {
  displayName: string;
  language: string;
  tone: string;
  timezone: string;
  defaultCountry: string;
  businessHours: string;
  questions: { interest: string; budget: string; knowsProjects: string };
  forbiddenTopics: { describe: string[]; patterns: string[] };
  messages: { fallback: string; needsHuman: string; nonText: string };
  maxReplyChars: number;
  llm: {
    model: string;
    temperature: number;
    historyLimit: number;
    timeoutMs: number;
  };
  knowledge: {
    maxFileBytes: number;
    maxCharsPerFile: number;
    maxCharsTotal: number;
  };
  crm: { provider: "hubspot"; transcriptProperty: string };
  whatsapp: {
    welcomeTemplate: {
      name: string;
      language: string;
      bodyPreview: string;
    } | null;
  };
};

export type CompanySettings = {
  config: CompanyConfig;
  instructions: string;
  /** Meta's Phone number ID of the company's WhatsApp number. Null until it has one. */
  whatsappPhoneNumberId: string | null;
  /** Read-only: written in code and filled in with the config. */
  platformRules: string;
  currentVersions: {
    config: string | null;
    instructions: string | null;
    whatsappPhoneNumberId: string | null;
  };
  limits: { instructionsMaxChars: number };
};

export type SettingsSaveResult = {
  changed: boolean;
  settings: CompanySettings;
};

export type SettingsVersion = {
  id: string;
  kind: "config" | "instructions" | "whatsappPhoneNumberId";
  createdAt: string;
  /** Null for the version that existed before versioning. */
  createdByEmail: string | null;
  viaSupport: boolean;
  restoredFromId: string | null;
  /** The one the company runs on now. */
  current: boolean;
  config: CompanyConfig | null;
  instructions: string | null;
  whatsappPhoneNumberId: string | null;
};

export type PromptPreview = {
  model: string;
  system: string;
  turnContext: string;
  tool: { name: string; description: string; input_schema: unknown };
  knowledge: { files: number; chars: number };
};
