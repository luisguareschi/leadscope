import { randomUUID } from "crypto";
import {
  CompanyRecord,
  MessageRecord,
  OperatorRecord,
  ProjectDraft,
  ProjectRecord,
  Store,
  ThreadListItem,
  ThreadPatch,
  ThreadRecord,
} from "./types";

export class MemoryStore implements Store {
  companies = new Map<string, CompanyRecord>();
  operators = new Map<string, OperatorRecord>();
  threads = new Map<string, ThreadRecord>();
  messages = new Map<string, MessageRecord>();
  projects = new Map<string, ProjectRecord>();
  usages: unknown[] = [];
  private lastTick = 0;

  private now(): string {
    const tick = Math.max(Date.now(), this.lastTick + 1);
    this.lastTick = tick;
    return new Date(tick).toISOString();
  }

  async listCompanies(): Promise<CompanyRecord[]> {
    return [...this.companies.values()];
  }

  async getCompany(id: string): Promise<CompanyRecord | null> {
    return this.companies.get(id) ?? null;
  }

  async companyByPhoneNumberId(phoneNumberId: string): Promise<CompanyRecord | null> {
    return (
      [...this.companies.values()].find((company) => company.whatsappPhoneNumberId === phoneNumberId) ??
      null
    );
  }

  async upsertCompany(input: {
    name: string;
    config: CompanyRecord["config"];
    secrets: CompanyRecord["secrets"];
    whatsappPhoneNumberId: string;
  }): Promise<CompanyRecord> {
    const existing = await this.companyByPhoneNumberId(input.whatsappPhoneNumberId);
    const record: CompanyRecord = {
      id: existing?.id ?? randomUUID(),
      name: input.name,
      config: input.config,
      secrets: input.secrets,
      whatsappPhoneNumberId: input.whatsappPhoneNumberId,
    };
    this.companies.set(record.id, record);
    return record;
  }

  async operatorByEmail(email: string): Promise<OperatorRecord | null> {
    return [...this.operators.values()].find((operator) => operator.email === email) ?? null;
  }

  async operatorBySupabaseUser(supabaseUserId: string): Promise<OperatorRecord | null> {
    return (
      [...this.operators.values()].find((operator) => operator.supabaseUserId === supabaseUserId) ?? null
    );
  }

  async upsertOperator(input: {
    companyId: string;
    email: string;
    supabaseUserId: string;
  }): Promise<OperatorRecord> {
    const existing = await this.operatorBySupabaseUser(input.supabaseUserId);
    const record: OperatorRecord = {
      id: existing?.id ?? randomUUID(),
      companyId: input.companyId,
      email: input.email,
      supabaseUserId: input.supabaseUserId,
    };
    this.operators.set(record.id, record);
    return record;
  }

  async threadByPhone(companyId: string, phone: string): Promise<ThreadRecord | null> {
    return (
      [...this.threads.values()].find((thread) => thread.companyId === companyId && thread.phone === phone) ??
      null
    );
  }

  async getThread(companyId: string, threadId: string): Promise<ThreadRecord | null> {
    const thread = this.threads.get(threadId);
    if (!thread || thread.companyId !== companyId) return null;
    return thread;
  }

  async createThread(input: {
    companyId: string;
    phone: string;
    state?: ThreadRecord["state"];
    email?: string | null;
    crmContactId?: string | null;
  }): Promise<ThreadRecord> {
    const now = this.now();
    const record: ThreadRecord = {
      id: randomUUID(),
      companyId: input.companyId,
      phone: input.phone,
      state: input.state ?? "Greeting",
      paused: false,
      needsHuman: false,
      interest: null,
      budget: null,
      knowsProjects: null,
      callTime: null,
      email: input.email ?? null,
      crmContactId: input.crmContactId ?? null,
      lastInboundAt: null,
      updatedAt: now,
    };
    this.threads.set(record.id, record);
    return record;
  }

  async saveThread(companyId: string, threadId: string, patch: ThreadPatch): Promise<ThreadRecord> {
    const thread = await this.getThread(companyId, threadId);
    if (!thread) throw new Error("thread not found");
    const next = { ...thread, ...patch, updatedAt: this.now() };
    this.threads.set(threadId, next);
    return next;
  }

  async listThreads(companyId: string): Promise<ThreadListItem[]> {
    const items = [...this.threads.values()].filter((thread) => thread.companyId === companyId);
    items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    return items.map((thread) => {
      const messages = [...this.messages.values()]
        .filter((message) => message.threadId === thread.id)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      const preview = messages[0]?.body.slice(0, 80) ?? "";
      return { ...thread, preview };
    });
  }

  async deleteThread(companyId: string, threadId: string): Promise<boolean> {
    const thread = await this.getThread(companyId, threadId);
    if (!thread) return false;
    this.threads.delete(threadId);
    for (const [id, message] of this.messages) {
      if (message.threadId === threadId) this.messages.delete(id);
    }
    return true;
  }

  async addMessage(input: {
    companyId: string;
    threadId: string;
    direction: "in" | "out";
    body: string;
    contentType: string;
    whatsappMessageId: string | null;
  }): Promise<{ message: MessageRecord; duplicate: boolean }> {
    if (input.whatsappMessageId) {
      const existing = [...this.messages.values()].find(
        (message) => message.whatsappMessageId === input.whatsappMessageId,
      );
      if (existing) return { message: existing, duplicate: true };
    }
    const message: MessageRecord = {
      id: randomUUID(),
      companyId: input.companyId,
      threadId: input.threadId,
      direction: input.direction,
      body: input.body,
      contentType: input.contentType,
      whatsappMessageId: input.whatsappMessageId,
      createdAt: this.now(),
    };
    this.messages.set(message.id, message);
    return { message, duplicate: false };
  }

  async listMessages(companyId: string, threadId: string): Promise<MessageRecord[]> {
    const thread = await this.getThread(companyId, threadId);
    if (!thread) return [];
    return [...this.messages.values()]
      .filter((message) => message.threadId === threadId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async messagesAfterLastOutbound(companyId: string, threadId: string): Promise<MessageRecord[]> {
    const messages = await this.listMessages(companyId, threadId);
    let lastOut = -1;
    messages.forEach((message, index) => {
      if (message.direction === "out") lastOut = index;
    });
    return messages.slice(lastOut + 1);
  }

  async listProjects(companyId: string): Promise<ProjectRecord[]> {
    return [...this.projects.values()].filter((project) => project.companyId === companyId);
  }

  async upsertProjects(companyId: string, rows: ProjectDraft[]): Promise<number> {
    const now = this.now();
    for (const row of rows) {
      const existing = [...this.projects.values()].find(
        (project) => project.companyId === companyId && project.slug === row.slug,
      );
      const record: ProjectRecord = {
        companyId,
        slug: row.slug,
        name: row.name,
        priceFrom: row.priceFrom,
        typologies: row.typologies,
        deliveryDate: row.deliveryDate,
        orientation: row.orientation,
        notes: row.notes,
        siteNotes: existing?.siteNotes ?? null,
        syncedAt: now,
      };
      this.projects.set(`${companyId}:${row.slug}`, record);
    }
    return rows.length;
  }

  async updateProjectSiteNotes(companyId: string, slug: string, siteNotes: string): Promise<void> {
    const key = `${companyId}:${slug}`;
    const existing = this.projects.get(key);
    if (!existing) return;
    this.projects.set(key, { ...existing, siteNotes, syncedAt: this.now() });
  }

  async recordUsage(input: {
    companyId: string;
    threadId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    this.usages.push(input);
  }
}
