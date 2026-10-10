export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function containsForbidden(reply: string, topics: string[]): boolean {
  const haystack = fold(reply);
  return topics.some((topic) => {
    const needle = fold(topic).trim();
    return needle.length > 0 && haystack.includes(needle);
  });
}

export function capReply(reply: string, maxChars: number): string {
  const trimmed = reply.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  if (maxChars <= 1) return trimmed.slice(0, maxChars);
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`;
}
