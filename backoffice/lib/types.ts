export type ThreadState = "greeting" | "qualify" | "answer" | "handoff" | "closed";
export type ThreadStatusFilter = "all" | "active" | "handoff" | "needs_human" | "paused" | "closed";
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
  usage: { usedChars: number; maxFileBytes: number; maxCharsPerFile: number; maxCharsTotal: number };
  acceptedExtensions: string[];
};

export type Me = { operator: { email: string }; company: { name: string; slug: string } };
