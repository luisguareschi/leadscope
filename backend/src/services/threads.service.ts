import { PrismaClient, Thread } from "@prisma/client";
import { listMessages } from "../conversation/messages";

export type ThreadView = {
  id: string;
  companyId: string;
  phone: string;
  state: Thread["state"];
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

function toThreadView(row: Thread): ThreadView {
  return {
    id: row.id,
    companyId: row.companyId,
    phone: row.phone,
    state: row.state,
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

export async function listThreads(db: PrismaClient, companyId: string) {
  const rows = await db.thread.findMany({
    where: { companyId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return rows.map((row) => ({
    ...toThreadView(row),
    preview: row.messages[0]?.body.slice(0, 80) ?? "",
  }));
}

export async function getThreadDetail(db: PrismaClient, companyId: string, threadId: string) {
  const row = await db.thread.findFirst({ where: { id: threadId, companyId } });
  if (!row) return null;
  const messages = await listMessages(db, companyId, row.id);
  return { thread: toThreadView(row), messages };
}

async function setFlags(
  db: PrismaClient,
  companyId: string,
  threadId: string,
  patch: { paused?: boolean; needsHuman?: boolean },
) {
  const existing = await db.thread.findFirst({ where: { id: threadId, companyId } });
  if (!existing) return null;
  const row = await db.thread.update({ where: { id: threadId }, data: patch });
  return toThreadView(row);
}

export function pauseThread(db: PrismaClient, companyId: string, threadId: string) {
  return setFlags(db, companyId, threadId, { paused: true });
}

export function resumeThread(db: PrismaClient, companyId: string, threadId: string) {
  return setFlags(db, companyId, threadId, { paused: false });
}

export function clearNeedsHuman(db: PrismaClient, companyId: string, threadId: string) {
  return setFlags(db, companyId, threadId, { needsHuman: false });
}

export async function deleteThread(db: PrismaClient, companyId: string, threadId: string): Promise<boolean> {
  const existing = await db.thread.findFirst({ where: { id: threadId, companyId } });
  if (!existing) return false;
  await db.thread.delete({ where: { id: threadId } });
  return true;
}
