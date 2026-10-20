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
  /** What the lead said, by collect item key. */
  collected: Record<string, string>;
  /** Bullets from the assistant, rewritten every turn: the conversation and what the lead wants. */
  summary: string | null;
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

/** One item to collect with the lead's value. `required` is null for a key no item has anymore. */
export type LeadField = {
  key: string;
  name: string;
  required: boolean | null;
  value: string | null;
};

export type ThreadDetail = {
  thread: Thread;
  fields: LeadField[];
  messages: ChatMessage[];
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
  /** Set while archived: its operators cannot sign in and the bot ignores its number. */
  archivedAt: string | null;
  operators: { id: string; email: string; archived: boolean }[];
};

export type CompaniesList = { companies: CompanySummary[] };

export type CompanyListStatus = "active" | "archived" | "all";

export type Operator = {
  id: string;
  email: string;
  createdAt: string;
  archivedAt: string | null;
  /** Linked to a Supabase user (invited or already existing). */
  hasLogin: boolean;
  invitedAt: string | null;
  /** Why the last invitation failed. Null once one succeeds. */
  inviteError: string | null;
  /** On PLATFORM_ADMIN_EMAILS: deleting the operator keeps their Supabase user. */
  platformAdmin: boolean;
};

/**
 * `sent`: invitation email. `linked`: the email already had a Supabase account, linked with no
 * email. `reset_sent`: a resend for such an account, which gets the password-reset email.
 */
export type InviteOutcome =
  | { status: "sent" | "linked" | "reset_sent" }
  | { status: "failed"; message: string };

export type OperatorWrite = { operator: Operator; invite: InviteOutcome };

export type AuthUserRemoval =
  | { status: "removed" | "kept_platform_admin" | "kept_operator" | "none" }
  | { status: "failed"; message: string };

export type DeleteCompanyResult = {
  deleted: { id: string; slug: string };
  authUsers: { removed: number; kept: number; failed: string[] };
};

export type SelectOption = { value: string; label: string };

export type SettingsOptions = {
  languages: SelectOption[];
  timezones: SelectOption[];
  countries: Array<SelectOption & { callingCode: string }>;
  models: {
    /** `anthropic`: listed with the company's key. `fallback`: the fixed list. */
    source: "anthropic" | "fallback";
    options: Array<SelectOption & { legacy: boolean }>;
  };
};

export type CreateCompanyInput = {
  name: string;
  slug: string;
  operatorEmail: string;
};

export type CreateCompanyResult = {
  company: CompanySummary;
  invite: InviteOutcome | null;
};

export type SecretName =
  | "anthropicApiKey"
  | "kapsoApiKey"
  | "kapsoWebhookSecret"
  | "hubspotAccessToken"
  | "formLeadSecret";

/** Write-only status. `last4` is absent when showing it would reveal the whole secret. */
export type SecretStatus = {
  name: SecretName;
  set: boolean;
  last4: string | null;
};

export type SecretsList = { secrets: SecretStatus[] };

/** Something the assistant finds out from the lead. `key` is how it is stored on the thread. */
export type CollectItem = {
  key: string;
  name: string;
  description: string;
  required: boolean;
};

/** Mirrors `MAX_COLLECT_ITEMS` in the backend. */
export const MAX_COLLECT_ITEMS = 10;

/** Mirrors the backend's `CompanyConfig` (companies/company-config.ts). */
export type CompanyConfig = {
  displayName: string;
  language: string;
  tone: string;
  timezone: string;
  defaultCountry: string;
  businessHours: string;
  collect: CollectItem[];
  forbiddenTopics: { describe: string[] };
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
  /** Phone number ID of the company's WhatsApp number (Kapso shows Meta's id). Null until it has one. */
  whatsappPhoneNumberId: string | null;
  /** Append to the API's public URL to get the webhook URL to paste in Kapso. */
  kapsoWebhookPath: string;
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

export type ConnectionCheckStatus = "ok" | "warning" | "error" | "skipped";

export type WhatsappConnectionCheck = {
  webhookPath: string;
  /** Every check passed, possibly with warnings. */
  ready: boolean;
  checks: Array<{
    id: "phoneNumberId" | "apiKey" | "webhookSecret" | "number" | "webhook";
    status: ConnectionCheckStatus;
    label: string;
    detail: string;
  }>;
};
