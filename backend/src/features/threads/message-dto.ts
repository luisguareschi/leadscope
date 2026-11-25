import type { Prisma } from "../../generated/prisma/client.js";

export const messageSelect = {
  id: true,
  direction: true,
  type: true,
  body: true,
  mediaPath: true,
  mediaMimeType: true,
  mediaFileName: true,
  status: true,
  error: true,
  sentAt: true,
  sentByEmail: true,
  sentBySupport: true,
} satisfies Prisma.MessageSelect;

type MessageRow = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

export function toMessageDto(message: MessageRow) {
  const {
    sentByEmail,
    sentBySupport,
    mediaPath,
    mediaMimeType,
    mediaFileName,
    ...rest
  } = message;
  return {
    ...rest,
    media: mediaPath
      ? {
          mimeType: mediaMimeType ?? "application/octet-stream",
          fileName: mediaFileName ?? null,
        }
      : null,
    /** Who wrote it in the panel. Null for the assistant, templates, and the lead. */
    sentBy: sentByEmail ? { email: sentByEmail, support: sentBySupport } : null,
  };
}
