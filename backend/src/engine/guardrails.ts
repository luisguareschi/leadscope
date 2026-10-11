/** Lower-cases and strips accents, so patterns can be written as "garantia" and still match "Garantía". */
export function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

/** Returns the first forbidden pattern found in the reply, or null. Invalid patterns are skipped. */
export function findForbidden(reply: string, patterns: string[]): string | null {
  const folded = foldText(reply);
  for (const pattern of patterns) {
    let regex: RegExp;
    try {
      regex = new RegExp(foldText(pattern), "u");
    } catch {
      continue;
    }
    if (regex.test(folded)) return pattern;
  }
  return null;
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
  if (sentenceEnd > maxChars * 0.5) return slice.slice(0, sentenceEnd + 1).trim();
  const wordEnd = slice.lastIndexOf(" ");
  return `${slice.slice(0, wordEnd > 0 ? wordEnd : maxChars - 1).trim()}…`;
}
