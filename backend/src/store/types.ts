import { CompanyConfig } from "../companies/config";
import { CompanySecrets } from "../crypto/secrets";
import { ThreadState } from "../engine/types";
import { ProjectFact } from "../engine/prompt";

export type CompanyRecord = {
  id: string;
  name: string;
  config: CompanyConfig;
  secrets: CompanySecrets;
  whatsappPhoneNumberId: string | null;
};

export type OperatorRecord = {
  id: string;
  companyId: string;
  supabaseUserId: string;
  email: string;
};

export type ThreadRecord = {
  id: string;
  companyId: string;
  phone: string;
  state: ThreadState;
  paused: boolean;
  needsHuman: boolean;
  interest: string | null;
  budget: string | null;
  knowsProjects: boolean | null;
  callTime: string | null;
  email: string | null;
  crmContactId: string | null;
  lastInboundAt: string | null;
  updatedAt: string;
};

export type MessageRecord = {
  id: string;
  companyId: string;
  threadId: string;
  direction: "in" | "out";
  body: string;
  contentType: string;
  whatsappMessageId: string | null;
  createdAt: string;
};

export type ProjectRecord = ProjectFact & {
  companyId: string;
  syncedAt: string | null;
};

export type ProjectDraft = Omit<ProjectFact, "siteNotes">;

export type ThreadPatch = Partial<
  Pick<
    ThreadRecord,
    | "state"
    | "paused"
    | "needsHuman"
    | "interest"
    | "budget"
    | "knowsProjects"
    | "callTime"
    | "email"
    | "crmContactId"
    | "lastInboundAt"
  >
>;

export type ThreadListItem = ThreadRecord & { preview: string };

export interface Store {
  listCompanies(): Promise<CompanyRecord[]>;
  getCompany(id: string): Promise<CompanyRecord | null>;
  companyByPhoneNumberId(phoneNumberId: string): Promise<CompanyRecord | null>;
  upsertCompany(input: {
    name: string;
    config: CompanyConfig;
    secrets: CompanySecrets;
    whatsappPhoneNumberId: string;
  }): Promise<CompanyRecord>;
  operatorByEmail(email: string): Promise<OperatorRecord | null>;
  operatorBySupabaseUser(supabaseUserId: string): Promise<OperatorRecord | null>;
  upsertOperator(input: {
    companyId: string;
    email: string;
    supabaseUserId: string;
  }): Promise<OperatorRecord>;
  threadByPhone(companyId: string, phone: string): Promise<ThreadRecord | null>;
  getThread(companyId: string, threadId: string): Promise<ThreadRecord | null>;
  createThread(input: {
    companyId: string;
    phone: string;
    state?: ThreadState;
    email?: string | null;
    crmContactId?: string | null;
  }): Promise<ThreadRecord>;
  saveThread(companyId: string, threadId: string, patch: ThreadPatch): Promise<ThreadRecord>;
  listThreads(companyId: string): Promise<ThreadListItem[]>;
  deleteThread(companyId: string, threadId: string): Promise<boolean>;
  addMessage(input: {
    companyId: string;
    threadId: string;
    direction: "in" | "out";
    body: string;
    contentType: string;
    whatsappMessageId: string | null;
  }): Promise<{ message: MessageRecord; duplicate: boolean }>;
  listMessages(companyId: string, threadId: string): Promise<MessageRecord[]>;
  messagesAfterLastOutbound(companyId: string, threadId: string): Promise<MessageRecord[]>;
  listProjects(companyId: string): Promise<ProjectRecord[]>;
  upsertProjects(companyId: string, rows: ProjectDraft[]): Promise<number>;
  updateProjectSiteNotes(companyId: string, slug: string, siteNotes: string): Promise<void>;
  recordUsage(input: {
    companyId: string;
    threadId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void>;
}
