/** What any WhatsApp provider's webhook parser hands to the conversation pipeline. */
export type InboundMessage = {
  /** Meta's Phone number ID of the business number that received the message. */
  phoneNumberId: string;
  waMessageId: string;
  /** The lead's WhatsApp id: international digits, no plus sign. */
  from: string;
  profileName: string | null;
  /** WhatsApp type. Quick-reply buttons and interactive replies count as text. */
  type: string;
  /** Message text, or the caption of an image, video, or document. Empty when there is none. */
  body: string;
  sentAt: Date;
};

export type StatusUpdate = {
  phoneNumberId: string;
  waMessageId: string;
  status: string;
};
