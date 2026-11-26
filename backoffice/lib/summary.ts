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

/**
 * Splits a stored thread summary into clean bullet lines, handling both real newlines and
 * double-escaped `\n` literals from older turns.
 */
export function parseSummaryBullets(
  summary: string | null | undefined,
): string[] {
  if (!summary) return [];
  return summary
    .replace(/\\r\\n|\\n/g, "\n")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => stripUnbalancedEdgeQuotes(line))
    .map((line) => line.replace(/^[-•*]+\s*/, "").trim())
    .map((line) => stripUnbalancedEdgeQuotes(line))
    .filter(Boolean);
}
