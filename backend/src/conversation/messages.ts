import { MessageDirection, Prisma, PrismaClient } from "@prisma/client";

export type ChatMessage = {
  id: string;
  companyId: string;
  threadId: string;
  direction: "in" | "out";
  body: string;
  contentType: string;
  whatsappMessageId: string | null;
  createdAt: string;
};

function toChatMessage(row: {
  id: string;
  companyId: string;
  threadId: string;
  direction: MessageDirection;
  body: string;
  contentType: string;
  whatsappMessageId: string | null;
  createdAt: Date;
}): ChatMessage {
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

export async function addMessage(
  db: PrismaClient,
  input: {
    companyId: string;
    threadId: string;
    direction: "in" | "out";
    body: string;
    contentType: string;
    whatsappMessageId: string | null;
    createdAt?: Date;
  },
): Promise<{ message: ChatMessage; duplicate: boolean }> {
  if (input.whatsappMessageId) {
    const existing = await db.message.findUnique({ where: { whatsappMessageId: input.whatsappMessageId } });
    if (existing) return { message: toChatMessage(existing), duplicate: true };
  }
  try {
    const row = await db.message.create({
      data: {
        companyId: input.companyId,
        threadId: input.threadId,
        direction: input.direction === "in" ? "inbound" : "outbound",
        body: input.body,
        contentType: input.contentType,
        whatsappMessageId: input.whatsappMessageId,
        createdAt: input.createdAt,
      },
    });
    return { message: toChatMessage(row), duplicate: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && input.whatsappMessageId) {
      const existing = await db.message.findUnique({ where: { whatsappMessageId: input.whatsappMessageId } });
      if (existing) return { message: toChatMessage(existing), duplicate: true };
    }
    throw err;
  }
}

export async function listMessages(db: PrismaClient, companyId: string, threadId: string): Promise<ChatMessage[]> {
  const rows = await db.message.findMany({
    where: { companyId, threadId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toChatMessage);
}

export async function messagesAfterLastOutbound(
  db: PrismaClient,
  companyId: string,
  threadId: string,
): Promise<ChatMessage[]> {
  const messages = await listMessages(db, companyId, threadId);
  let lastOut = -1;
  messages.forEach((message, index) => {
    if (message.direction === "out") lastOut = index;
  });
  return messages.slice(lastOut + 1);
}
