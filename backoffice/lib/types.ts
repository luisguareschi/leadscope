export type ThreadState =
  "greeting" | "qualify" | "answer" | "handoff" | "closed";

export type SystemLeadStage =
  | "qualifying"
  | "to_contact"
  | "contacted"
  | "not_interested"
  | "disqualified"
  | "no_response";

/** Pipeline stage key: one of the 6 system stages or a company-defined custom stage. */
export type LeadStage = string;

export type StageColor =
  | "pending"
  | "warning"
  | "ok"
  | "muted"
  | "error"
  | "info"
  | "purple"
  | "cyan"
  | "amber"
  | "orange"
  | "pink"
  | "lime";

export type StageConfig = {
  key: string;
  label: string;
  color: StageColor;
  system: boolean;
};

export const MAX_CUSTOM_STAGES = 10;

/** What the assistant is doing in the thread, independent of the stage. */
export type BotActivity = "active" | "paused" | "needs_human";
export type StageFilter = string;
export type BotFilter = "all" | BotActivity;
export type AssigneeFilter = "all" | "me" | "none";
export type ThreadFilters = {
  stage: StageFilter;
  bot: BotFilter;
  assignee: AssigneeFilter;
  search: string;
};
export type CrmStatus = "none" | "pending" | "synced" | "failed";

/** An operator of the company who can have threads. */
export type Assignee = { id: string; email: string; me: boolean };

export type Thread = {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  source: "whatsapp" | "form";
  state: ThreadState;
  stage: LeadStage;
  botActivity: BotActivity;
  paused: boolean;
  pausedAt: string | null;
  needsHuman: boolean;
  needsHumanReason: string | null;
  /** When it reached Por contactar. */
  handedOffAt: string | null;
  /** The lead wrote after reaching Por contactar, or after being marked Contactado. */
  wroteAgain: boolean;
  assignee: { id: string; email: string; archived: boolean } | null;
  assignedAt: string | null;
  contactedAt: string | null;
  /** Email of whoever marked it contacted. */
  contactedBy: string | null;
  /** The last stage change; `by` is null when the assistant made it. */
  stageChange: { at: string; by: string | null } | null;
  /** What the lead said, by collect item key. */
  collected: Record<string, string>;
  /** Bullets from the assistant, rewritten every turn: the conversation and what the lead wants. */
  summary: string | null;
  callTime: string | null;
  lastInboundAt: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  replyWindowClosesAt: string | null;
  /** Null while the company has HubSpot off. */
  crm: {
    status: CrmStatus;
    contactId: string | null;
    /** The contact's record in HubSpot, once the account is known. */
    url: string | null;
    syncedAt: string | null;
    lastError: string | null;
    retriesExhausted: boolean;
  } | null;
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
  media: { mimeType: string; fileName: string | null } | null;
  status: string | null;
  /** Why WhatsApp refused it when it was sent. */
  error: string | null;
  sentAt: string;
  /** Who wrote it in the panel; null for the assistant, templates, and the lead. */
  sentBy: { email: string; support: boolean } | null;
};

export type ThreadsPage = { threads: Thread[]; nextCursor: string | null };

export type ThreadsSummary = {
  total: number;
  stages: Record<string, number>;
  bot: Record<BotActivity, number>;
  /** Null for a platform admin in support access, who has no operator row here. */
  mine: { all: number; toContact: number } | null;
  unassignedToContact: number;
};

export type KnowledgeFolder = {
  id: string;
  /** Null at the root. */
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeVisibility = "internal" | "public";

export type KnowledgeFile = {
  id: string;
  /** Null at the root. */
  folderId: string | null;
  name: string;
  format: string;
  formatLabel: string;
  mimeType: string;
  sizeBytes: number;
  charCount: number;
  visibility: KnowledgeVisibility;
  hasFile: boolean;
  description: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeList = {
  folders: KnowledgeFolder[];
  files: KnowledgeFile[];
  usage: {
    usedChars: number;
    maxFileBytes: number;
    maxCharsPerFile: number;
    maxCharsTotal: number;
  };
  acceptedExtensions: string[];
};

export type AssistantStatus = {
  paused: boolean;
  pausedAt: string | null;
  pausedByEmail: string | null;
};

export type Me = {
  operator: { email: string } | null;
  /** The company the panel works in: the operator's own, or the one a platform admin entered. */
  /** `id` never changes and is never reused; a deleted company's slug can be. */
  company: {
    id: string;
    name: string;
    slug: string;
    assistantPaused: boolean;
    assistantPausedAt: string | null;
    assistantPausedByEmail: string | null;
  } | null;
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
  assistantPaused: boolean;
  assistantPausedAt: string | null;
  assistantPausedByEmail: string | null;
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
  /** The assistant's own name, e.g. "Almira". Empty: it has none. The company's is `companyName`. */
  assistantName: string;
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
  stages: StageConfig[];
  followUp: {
    enabled: boolean;
    delayHours: number;
    maxCount: number;
  };
  inactivity: {
    noResponseHours: number | null;
  };
};

export type CompanySettings = {
  config: CompanyConfig;
  /** `Company.name`: what the prompt, Empresas, and the panel call the company. */
  companyName: string;
  instructions: string;
  /** Phone number ID of the company's WhatsApp number (Kapso shows Meta's id). Null until it has one. */
  whatsappPhoneNumberId: string | null;
  /** Append to the API's public URL to get the webhook URL to paste in Kapso. */
  kapsoWebhookPath: string;
  /** Append to the API's public URL to get the URL the form workflow posts to. */
  formLeadPath: string;
  hubspot: HubspotSettings;
  assistant: AssistantStatus;
  /** Read-only: written in code and filled in with the config. */
  platformRules: string;
  currentVersions: {
    config: string | null;
    instructions: string | null;
    companyName: string | null;
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
  kind: "config" | "instructions" | "companyName" | "whatsappPhoneNumberId";
  createdAt: string;
  /** Null for the version that existed before versioning. */
  createdByEmail: string | null;
  viaSupport: boolean;
  restoredFromId: string | null;
  /** The one the company runs on now. */
  current: boolean;
  config: CompanyConfig | null;
  instructions: string | null;
  companyName: string | null;
  whatsappPhoneNumberId: string | null;
};

export type PromptPreview = {
  model: string;
  /** Who the prompt says is talking (may be empty), and for which company. */
  names: { assistant: string; company: string };
  system: string;
  turnContext: string;
  tool: { name: string; description: string; input_schema: unknown };
  knowledge: {
    files: number;
    chars: number;
    /** In the order the prompt lists them: "Proyectos / Tres Cruces / Precios.xlsx". */
    documents: { path: string; chars: number }[];
  };
};

export type HubspotSettings = {
  /** Off: no contact is created or updated, and the panel hides HubSpot in threads. */
  enabled: boolean;
  /** From HubSpot's account info, for the "Abrir en HubSpot" link. */
  portalId: string | null;
  uiDomain: string | null;
};

export type ConnectionCheckStatus = "ok" | "warning" | "error" | "skipped";

export type IntegrationCheck = {
  id: string;
  status: ConnectionCheckStatus;
  label: string;
  detail: string;
};

/** A Probar conexión result. `ready`: every check passed, possibly with warnings. */
export type IntegrationCheckResult = {
  ready: boolean;
  checks: IntegrationCheck[];
};

export type WhatsappConnectionCheck = IntegrationCheckResult & {
  webhookPath: string;
};

export type IntegrationCheckTarget = "hubspot" | "anthropic" | "forms";

export type ModelSpend = {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  usd: number | null;
};

export type AdvisorMetrics = {
  operatorId: string;
  email: string;
  assigned: number;
  pendingOver24h: number;
  contactedInRange: number;
  medianMinutesToContact: number | null;
};

export type FieldCompletionMetric = {
  key: string;
  name: string;
  required: boolean;
  collected: number;
  rate: number | null;
};

/** One company's metrics for a calendar range. Rates are 0..1; null when denominator is zero. */
export type CompanyMetrics = {
  company: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    assistantPaused: boolean;
  };
  range: { from: string; to: string; days: number };
  generatedAt: string;
  leads: number;
  leadsBySource: { whatsapp: number; form: number };
  leadsPerDay: {
    date: string;
    qualifying: number;
    to_contact: number;
    contacted: number;
    not_interested: number;
    disqualified: number;
    no_response: number;
  }[];
  funnel: {
    leads: number;
    qualified: number;
    qualificationRate: number | null;
    contacted: number;
    contactedRate: number | null;
    qualifying: number;
    toContact: number;
    notInterested: number;
    notInterestedRate: number | null;
    disqualified: number;
    noResponse: number;
  };
  forms: {
    leads: number;
    replied: number;
    replyRate: number | null;
  };
  outOfHours: number;
  outOfHoursRate: number | null;
  timeToContact: {
    count: number;
    medianMinutes: number | null;
    p90Minutes: number | null;
  };
  advisors: AdvisorMetrics[];
  assistant: {
    autonomousLeads: number;
    autonomyRate: number | null;
    nonTextLeads: number;
    nonTextRate: number | null;
    nonTextMessages: number;
    failedOutboundMessages: number;
    fieldCompletion: FieldCompletionMetric[];
  };
  queue: {
    toContact: number;
    unassigned: number;
    unassignedOver24h: number;
    oldestWaitingMinutes: number | null;
  };
  needsHuman: {
    total: number;
    pausedManually: number;
    byReason: Record<string, number>;
  };
  knowledge: {
    files: number;
    lastUploadAt: string | null;
    daysSinceLastUpload: number | null;
  };
  hubspot: { enabled: boolean; pending: number; failing: number };
  spend: {
    anthropic: {
      usd: number | null;
      realUsd: number | null;
      testUsd: number | null;
      calls: number;
      realCalls: number;
      testCalls: number;
      byModel: ModelSpend[];
      unpricedModels: string[];
    };
    whatsapp: {
      usd: number;
      templates: number;
      serviceMessages: number;
      freeServiceMessages: number;
      billableServiceMessages: number;
      currentMonthTotalMessages: number;
    };
    totalUsd: number;
    projectedMonthlyUsd: number | null;
    perLeadUsd: number | null;
    anthropicPerLeadUsd: number | null;
  };
};

/** Platform-admin comparison. `status=all` includes archived companies. */
export type CompaniesMetrics = {
  range: { from: string; to: string };
  rows: {
    company: {
      id: string;
      name: string;
      slug: string;
      archived: boolean;
      assistantPaused: boolean;
    };
    leads: number;
    qualificationRate: number | null;
    contactedRate: number | null;
    medianMinutesToContact: number | null;
    unassignedToContact: number;
    needsHuman: number;
    issuesCount: number;
    daysSinceLastUpload: number | null;
    spendUsd: number;
    anthropicUsd: number | null;
  }[];
};

/** Probar asistente: one message of the test chat. */
export type TestChatRole = "lead" | "assistant";

/** The simulated lead the test chat carries from turn to turn, as the engine would store it. */
export type TestLead = {
  state: "greeting" | "qualify" | "answer" | "handoff" | "closed";
  stage: LeadStage;
  collected: Record<string, string>;
  callTime: string | null;
  summary: string | null;
};

export type TestDraftOverride = {
  companyName?: string;
  config?: CompanyConfig;
  instructions?: string;
};

export type TestTurnRequest = {
  messages: Array<{ role: TestChatRole; body: string }>;
  lead?: TestLead;
  leadName?: string | null;
  draft?: TestDraftOverride;
};

export type TestTurnResponse = {
  /** What the lead would receive on WhatsApp. */
  reply: string;
  /** What the model wrote when the lead gets a fixed line instead. */
  modelReply: string | null;
  /** Public files from Conocimiento that the assistant would send on this turn. */
  sentFiles: Array<{ id: string; path: string; format: string }>;
  lead: TestLead;
  model: {
    intent: "continue" | "qualified" | "not_interested" | "disqualified";
    callNow: boolean;
    needsHuman: boolean;
    forbiddenTopic: string | null;
  } | null;
  /** Why the real assistant would stop here and wait for a person. */
  stoppedReason: string | null;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  } | null;
};
