export type SupportedImageMediaType =
  "image/jpeg" | "image/png" | "image/gif" | "image/webp";

export type ImageAttachment = {
  mediaType: SupportedImageMediaType;
  base64: string;
};

export type HistoryMessage = {
  direction: "inbound" | "outbound";
  type: string;
  body: string;
  /** Set when a person wrote it in the panel; null for the assistant's own messages. */
  sentByEmail?: string | null;
  /** Original filename for document/image messages. */
  mediaFileName?: string | null;
  /** Attached image bytes to pass directly to Claude Vision on this turn. */
  image?: ImageAttachment | null;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  images?: ImageAttachment[];
};

/**
 * Starts every message an advisor wrote from the panel. The platform rules name it, so the model
 * treats those lines as the company's word and never writes the label itself.
 */
export const ADVISOR_LABEL = "[Sent by a human advisor, not by you]";

const NON_TEXT_LABELS: Record<string, string> = {
  audio: "a voice note",
  image: "an image",
  video: "a video",
  sticker: "a sticker",
  document: "a file",
  location: "a location",
  contacts: "a contact card",
};

function contentOf(message: HistoryMessage): string | null {
  const body = message.body.trim();
  if (message.direction === "outbound") {
    const fileNote =
      (message.type === "document" || message.type === "image") &&
      message.mediaFileName
        ? `[Sent file: ${message.mediaFileName}]`
        : null;
    const text = [fileNote, body].filter(Boolean).join(" ").trim();
    if (!text) return null;
    return message.sentByEmail ? `${ADVISOR_LABEL} ${text}` : text;
  }
  if (message.type === "text") return body || null;
  if (message.type === "audio" && body) {
    return `[The lead sent a voice note. Transcript: "${body}"]`;
  }
  if (message.type === "image" && message.image) {
    const caption = body ? ` with the caption "${body}"` : "";
    return `[The lead sent an image${caption}.]`;
  }
  const label = NON_TEXT_LABELS[message.type] ?? "a message you cannot read";
  const caption = body ? ` with the caption "${body}"` : "";
  return `[The lead sent ${label}${caption}. You cannot see or hear attachments.]`;
}

/**
 * Turns stored messages into the alternating user/assistant turns the Messages API expects.
 * Consecutive messages from the same side are joined, and the list always starts with the lead.
 * The company's side is the assistant role, whether the assistant or an advisor wrote it; an
 * advisor's messages carry `ADVISOR_LABEL`.
 *
 * When the first turn left is the company's side, a note opens the list: a form lead got the
 * welcome before writing, so it says so; a WhatsApp lead always writes first, so earlier messages
 * are missing (cut by `limit`, or a blank lead message that has no turn).
 */
export function buildChatTurns(
  messages: HistoryMessage[],
  limit: number,
  source: "whatsapp" | "form",
): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of messages.slice(-limit)) {
    const content = contentOf(message);
    if (!content) continue;
    const role = message.direction === "inbound" ? "user" : "assistant";
    const image = role === "user" && message.image ? message.image : null;
    const last = turns.at(-1);
    if (last?.role === role) {
      last.content = `${last.content}\n${content}`;
      if (image) last.images = [...(last.images ?? []), image];
    } else {
      turns.push({
        role,
        content,
        ...(image ? { images: [image] } : {}),
      });
    }
  }
  if (turns[0]?.role === "assistant") {
    turns.unshift({
      role: "user",
      content:
        source === "form"
          ? "[The lead filled in a contact form.]"
          : "[Earlier messages of this conversation are not shown.]",
    });
  }
  return turns;
}
