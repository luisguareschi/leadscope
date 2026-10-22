import type { Prisma } from "../../generated/prisma/client.js";

export const messageSelect = {
  id: true,
  direction: true,
  type: true,
  body: true,
  status: true,
  error: true,
  sentAt: true,
  sentByEmail: true,
  sentBySupport: true,
} satisfies Prisma.MessageSelect;

type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export function toMessageDto(message: MessageRow) {
  const { sentByEmail, sentBySupport, ...rest } = message;
  return {
    ...rest,
    /** Who wrote it in the panel. Null for the assistant, templates, and the lead. */
    sentBy: sentByEmail ? { email: sentByEmail, support: sentBySupport } : null,
  };
}
