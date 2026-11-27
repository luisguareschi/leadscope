/** What any WhatsApp provider's webhook parser hands to the conversation pipeline. */
export type InboundMessage = {
  /** Meta's Phone number ID of the business number that received the message. */
  phoneNumberId: string;
  waMessageId: string;
  /** The lead's WhatsApp id: international digits, no plus sign. Null for BSUID-only senders. */
  from: string | null;
  /** Meta Business-Scoped User ID (e.g. `CO.1602439504987482`), when provided by WhatsApp/Kapso. */
  bsuid?: string | null;
  /** WhatsApp username without leading `@` (e.g. `n.c__17`), when provided. */
  username?: string | null;
  profileName: string | null;
  /** WhatsApp type. Quick-reply buttons and interactive replies count as text. */
  type: string;
  /** Message text, audio transcript (from Kapso), or the caption of an image/video/document. */
  body: string;
  /** Media download URL or provider media id for inbound attachments (e.g. images). */
  mediaUrl?: string | null;
  mediaId?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  sentAt: Date;
};

export type StatusUpdate = {
  phoneNumberId: string;
  waMessageId: string;
  status: string;
};
