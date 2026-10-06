import { Prisma, PrismaClient, ThreadState as DbThreadState } from "@prisma/client";
import { CompanyConfig, parseCompanyConfig } from "../companies/config";
import { CompanySecrets, decryptSecrets, encryptSecrets, emptySecrets } from "../crypto/secrets";
import { ThreadState } from "../engine/types";
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

function asState(state: DbThreadState): ThreadState {
  return state;
}

function toDbState(state: ThreadState): DbThreadState {
  return state;
}

export class PrismaStore implements Store {
  constructor(
    private readonly db: PrismaClient,
    private readonly key: Buffer | null,
  ) {}

  private toCompany(row: {
    id: string;
    name: string;
    config: Prisma.JsonValue;
    encryptedSecrets: string | null;
    whatsappPhoneNumberId: string | null;
  }): CompanyRecord {
    return {
      id: row.id,
      name: row.name,
      config: parseCompanyConfig(row.config),
      secrets: decryptSecrets(row.encryptedSecrets, this.key),
      whatsappPhoneNumberId: row.whatsappPhoneNumberId,
    };
  }

  private toThread(row: {
    id: string;
    companyId: string;
    phone: string;
    state: DbThreadState;
    paused: boolean;
    needsHuman: boolean;
    interest: string | null;
    budget: string | null;
    knowsProjects: boolean | null;
    callTime: string | null;
    email: string | null;
    crmContactId: string | null;
    lastInboundAt: Date | null;
    updatedAt: Date;
  }): ThreadRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      phone: row.phone,
      state: asState(row.state),
      paused: row.paused,
      needsHuman: row.needsHuman,
      interest: row.interest,
      budget: row.budget,
      knowsProjects: row.knowsProjects,
      callTime: row.callTime,
      email: row.email,
      crmContactId: row.crmContactId,
      lastInboundAt: row.lastInboundAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private toMessage(row: {
    id: string;
    companyId: string;
    threadId: string;
    direction: "inbound" | "outbound";
    body: string;
    contentType: string;
    whatsappMessageId: string | null;
    createdAt: Date;
  }): MessageRecord {
    return {
      id: row.id,
      companyId: row.companyId,
      threadId: row.threadId,
      direction: row.direction === "inbound" ? "in" : "out",
      body: row.body,
      contentType: row.contentType,
      whatsappMessageId: row.whatsappMessageId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  async listCompanies(): Promise<CompanyRecord[]> {
    const rows = await this.db.company.findMany();
    return rows.map((row) => this.toCompany(row));
  }

  async getCompany(id: string): Promise<CompanyRecord | null> {
    const row = await this.db.company.findUnique({ where: { id } });
    return row ? this.toCompany(row) : null;
  }

  async companyByPhoneNumberId(phoneNumberId: string): Promise<CompanyRecord | null> {
    const row = await this.db.company.findUnique({ where: { whatsappPhoneNumberId: phoneNumberId } });
    return row ? this.toCompany(row) : null;
  }

  async upsertCompany(input: {
    name: string;
    config: CompanyConfig;
    secrets: CompanySecrets;
    whatsappPhoneNumberId: string;
  }): Promise<CompanyRecord> {
    if (!this.key) throw new Error("SECRETS_ENCRYPTION_KEY is required to store company secrets");
    const encryptedSecrets = encryptSecrets(input.secrets, this.key);
    const row = await this.db.company.upsert({
      where: { whatsappPhoneNumberId: input.whatsappPhoneNumberId },
      create: {
        name: input.name,
        config: input.config,
        encryptedSecrets,
        whatsappPhoneNumberId: input.whatsappPhoneNumberId,
      },
      update: {
        name: input.name,
        config: input.config,
        encryptedSecrets,
      },
    });
    return this.toCompany(row);
  }

  async operatorByEmail(email: string): Promise<OperatorRecord | null> {
    const row = await this.db.operator.findFirst({ where: { email } });
    return row;
  }

  async operatorBySupabaseUser(supabaseUserId: string): Promise<OperatorRecord | null> {
    return this.db.operator.findUnique({ where: { supabaseUserId } });
  }

  async upsertOperator(input: {
    companyId: string;
    email: string;
    supabaseUserId: string;
  }): Promise<OperatorRecord> {
    return this.db.operator.upsert({
      where: { supabaseUserId: input.supabaseUserId },
      create: input,
      update: { email: input.email, companyId: input.companyId },
    });
  }

  async threadByPhone(companyId: string, phone: string): Promise<ThreadRecord | null> {
    const row = await this.db.thread.findUnique({ where: { companyId_phone: { companyId, phone } } });
    return row ? this.toThread(row) : null;
  }

  async getThread(companyId: string, threadId: string): Promise<ThreadRecord | null> {
    const row = await this.db.thread.findFirst({ where: { id: threadId, companyId } });
    return row ? this.toThread(row) : null;
  }

  async createThread(input: {
    companyId: string;
    phone: string;
    state?: ThreadState;
    email?: string | null;
    crmContactId?: string | null;
  }): Promise<ThreadRecord> {
    const row = await this.db.thread.create({
      data: {
        companyId: input.companyId,
        phone: input.phone,
        state: toDbState(input.state ?? "Greeting"),
        email: input.email ?? null,
        crmContactId: input.crmContactId ?? null,
      },
    });
    return this.toThread(row);
  }

  async saveThread(companyId: string, threadId: string, patch: ThreadPatch): Promise<ThreadRecord> {
    const existing = await this.getThread(companyId, threadId);
    if (!existing) throw new Error("thread not found");
    const row = await this.db.thread.update({
      where: { id: threadId },
      data: {
        state: patch.state ? toDbState(patch.state) : undefined,
        paused: patch.paused,
        needsHuman: patch.needsHuman,
        interest: patch.interest,
        budget: patch.budget,
        knowsProjects: patch.knowsProjects,
        callTime: patch.callTime,
        email: patch.email,
        crmContactId: patch.crmContactId,
        lastInboundAt: patch.lastInboundAt ? new Date(patch.lastInboundAt) : undefined,
      },
    });
    return this.toThread(row);
  }

  async listThreads(companyId: string): Promise<ThreadListItem[]> {
    const rows = await this.db.thread.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    return rows.map((row) => ({
      ...this.toThread(row),
      preview: row.messages[0]?.body.slice(0, 80) ?? "",
    }));
  }

  async deleteThread(companyId: string, threadId: string): Promise<boolean> {
    const existing = await this.getThread(companyId, threadId);
    if (!existing) return false;
    await this.db.thread.delete({ where: { id: threadId } });
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
      const existing = await this.db.message.findUnique({
        where: { whatsappMessageId: input.whatsappMessageId },
      });
      if (existing) return { message: this.toMessage(existing), duplicate: true };
    }
    try {
      const row = await this.db.message.create({
        data: {
          companyId: input.companyId,
          threadId: input.threadId,
          direction: input.direction === "in" ? "inbound" : "outbound",
          body: input.body,
          contentType: input.contentType,
          whatsappMessageId: input.whatsappMessageId,
        },
      });
      return { message: this.toMessage(row), duplicate: false };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await this.db.message.findUnique({
          where: { whatsappMessageId: input.whatsappMessageId ?? "" },
        });
        if (existing) return { message: this.toMessage(existing), duplicate: true };
      }
      throw err;
    }
  }

  async listMessages(companyId: string, threadId: string): Promise<MessageRecord[]> {
    const thread = await this.getThread(companyId, threadId);
    if (!thread) return [];
    const rows = await this.db.message.findMany({
      where: { threadId, companyId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((row) => this.toMessage(row));
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
    const rows = await this.db.project.findMany({ where: { companyId }, orderBy: { name: "asc" } });
    return rows.map((row) => ({
      companyId: row.companyId,
      slug: row.slug,
      name: row.name,
      priceFrom: row.priceFrom,
      typologies: row.typologies,
      deliveryDate: row.deliveryDate,
      orientation: row.orientation,
      notes: row.notes,
      siteNotes: row.siteNotes,
      syncedAt: row.syncedAt?.toISOString() ?? null,
    }));
  }

  async upsertProjects(companyId: string, rows: ProjectDraft[]): Promise<number> {
    const now = new Date();
    for (const row of rows) {
      await this.db.project.upsert({
        where: { companyId_slug: { companyId, slug: row.slug } },
        create: { companyId, ...row, syncedAt: now },
        update: {
          name: row.name,
          priceFrom: row.priceFrom,
          typologies: row.typologies,
          deliveryDate: row.deliveryDate,
          orientation: row.orientation,
          notes: row.notes,
          syncedAt: now,
        },
      });
    }
    return rows.length;
  }

  async updateProjectSiteNotes(companyId: string, slug: string, siteNotes: string): Promise<void> {
    await this.db.project.updateMany({
      where: { companyId, slug },
      data: { siteNotes, syncedAt: new Date() },
    });
  }

  async recordUsage(input: {
    companyId: string;
    threadId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    await this.db.llmUsage.create({ data: input });
  }
}

export function emptyCompanySecrets(): CompanySecrets {
  return emptySecrets();
}
