export type HistoryMessage = {
  direction: "inbound" | "outbound";
  type: string;
  body: string;
  /** Set when a person wrote it in the panel; null for the assistant's own messages. */
  sentByEmail?: string | null;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

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
    if (!body) return null;
    return message.sentByEmail ? `${ADVISOR_LABEL} ${body}` : body;
  }
  if (message.type === "text") return body || null;
  const label = NON_TEXT_LABELS[message.type] ?? "a message you cannot read";
  const caption = body ? ` with the caption "${body}"` : "";
  return `[The lead sent ${label}${caption}. You cannot see or hear attachments.]`;
}

/**
 * Turns stored messages into the alternating user/assistant turns the Messages API expects.
 * Consecutive messages from the same side are joined, and the list always starts with the lead.
 * The company's side is the assistant role, whether the assistant or an advisor wrote it; an
 * advisor's messages carry `ADVISOR_LABEL`.
 */
export function buildChatTurns(
  messages: HistoryMessage[],
  limit: number,
): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const message of messages.slice(-limit)) {
    const content = contentOf(message);
    if (!content) continue;
    const role = message.direction === "inbound" ? "user" : "assistant";
    const last = turns.at(-1);
    if (last?.role === role) last.content = `${last.content}\n${content}`;
    else turns.push({ role, content });
  }
  if (turns[0]?.role === "assistant") {
    turns.unshift({
      role: "user",
      content: "[The lead filled in a contact form.]",
    });
  }
  return turns;
}
