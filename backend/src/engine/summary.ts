/**
 * Strips an unmatched leading or trailing double-quote that LLMs occasionally emit at the
 * boundary of a tool-call string (e.g. `...contacte"`), while preserving balanced quotes inside.
 */
function stripUnbalancedEdgeQuotes(line: string): string {
  let result = line.trim();
  const quoteCount = (text: string) => (text.match(/"/g) ?? []).length;
  if (result.length >= 2 && result.startsWith('"') && result.endsWith('"')) {
    const inner = result.slice(1, -1);
    if (!inner.includes('"')) result = inner.trim();
  }
  if (result.endsWith('"') && quoteCount(result) % 2 === 1) {
    result = result.slice(0, -1).trimEnd();
  }
  if (result.startsWith('"') && quoteCount(result) % 2 === 1) {
    result = result.slice(1).trimStart();
  }
  return result;
}

function splitBullets(raw: string): string[] {
  // Models occasionally double-escape newlines inside tool JSON (`\\n`), which arrives as
  // literal `\n` characters. Convert them to real line breaks before splitting.
  const normalized = raw.replace(/\\r\\n|\\n/g, "\n").replace(/\r\n?/g, "\n");
  return normalized
    .split("\n")
    .map((line) => stripUnbalancedEdgeQuotes(line))
    .map((line) => line.replace(/^[-•*]+\s*/, "").trim())
    .map((line) => stripUnbalancedEdgeQuotes(line))
    .filter((line) => line.length > 0);
}

/**
 * Normalizes a model summary (array of bullet strings or a single string) into canonical
 * newline-separated `"- "` bullets. Returns null when nothing meaningful remains.
 */
export function normalizeSummary(
  raw: string | string[] | null | undefined,
): string | null {
  if (raw === null || raw === undefined) return null;
  const parts = Array.isArray(raw)
    ? raw.flatMap((item) =>
        typeof item === "string" ? splitBullets(item) : [],
      )
    : typeof raw === "string"
      ? splitBullets(raw)
      : [];
  if (parts.length === 0) return null;
  return parts.map((item) => `- ${item}`).join("\n");
}
