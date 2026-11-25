/** Maximum number of separate WhatsApp messages the assistant may send in a single turn. */
export const MAX_REPLY_BUBBLES = 4;

/** Lower-cases and strips accents, so text can be compared regardless of "Garantía" vs "garantia". */
export function foldText(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Keeps WhatsApp replies short. Cuts at the last sentence end that fits, or the last word. */
export function capReply(reply: string, maxChars: number): string {
  const text = reply.trim();
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const sentenceEnd = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("\n"),
  );
  if (sentenceEnd > maxChars * 0.5)
    return slice.slice(0, sentenceEnd + 1).trim();
  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxChars - 1).trim()}…`;
}

/**
 * Normalizes model replies into 1..MAX_REPLY_BUBBLES short WhatsApp messages bounded by
 * `maxTotalChars` across the whole turn (`result.join("\n\n").length <= maxTotalChars`).
 * Splits a single multi-paragraph string on blank lines so accidental walls of text still
 * arrive as separate bubbles.
 */
export function normalizeReplies(
  input: { replies?: readonly string[]; reply?: string | null },
  maxTotalChars: number,
): string[] {
  const fromArray = Array.isArray(input.replies)
    ? input.replies.map((item) => item.trim()).filter(Boolean)
    : [];
  const raw =
    fromArray.length > 0
      ? fromArray
      : input.reply?.trim()
        ? [input.reply.trim()]
        : [];
  if (raw.length === 0) return [];

  const first = raw[0]!;
  const split =
    raw.length === 1 && /\n{2,}/.test(first)
      ? first
          .split(/\n{2,}/)
          .map((part: string) => part.trim())
          .filter(Boolean)
      : raw;

  const boundedCount =
    split.length > MAX_REPLY_BUBBLES
      ? [
          ...split.slice(0, MAX_REPLY_BUBBLES - 1),
          split.slice(MAX_REPLY_BUBBLES - 1).join("\n\n"),
        ]
      : split;

  const result: string[] = [];
  let remaining = maxTotalChars;
  for (const part of boundedCount) {
    const separatorCost = result.length === 0 ? 0 : 2;
    const budget = remaining - separatorCost;
    if (budget <= 0) break;
    if (part.length <= budget) {
      result.push(part);
      remaining -= separatorCost + part.length;
    } else {
      if (result.length > 0 && budget < 20) break;
      const capped = capReply(part, budget);
      if (capped) result.push(capped);
      break;
    }
  }
  return result;
}
