import type { ReactNode } from "react";

/** WhatsApp's own markup: *bold*, _italic_, ~strikethrough~. */
export type WhatsappMarker = "*" | "_" | "~";

const TAGS: Record<WhatsappMarker, "strong" | "em" | "s"> = {
  "*": "strong",
  _: "em",
  "~": "s",
};

const isMarker = (char: string): char is WhatsappMarker => char in TAGS;
const isSpace = (char: string | undefined) => !char || /\s/u.test(char);
/** Markers only count next to the start or end, a space, or punctuation, like in WhatsApp. */
const isEdge = (char: string | undefined) =>
  char === undefined || /[\s\p{P}\p{S}]/u.test(char);

/** Where the marker at `open` closes on the same line, or -1. */
function closingOf(text: string, open: number): number {
  const marker = text[open]!;
  for (let index = open + 2; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\n") return -1;
    if (char === marker && !isSpace(text[index - 1]) && isEdge(text[index + 1]))
      return index;
  }
  return -1;
}

/** Renders a message the way WhatsApp shows it. Markup that does not close stays as typed. */
export function renderWhatsapp(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let plain = "";
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    const opens =
      isMarker(char) &&
      isEdge(text[index - 1]) &&
      !isSpace(text[index + 1]) &&
      text[index + 1] !== char;
    const close = opens ? closingOf(text, index) : -1;
    if (close === -1) {
      plain += char;
      index += 1;
      continue;
    }
    if (plain) nodes.push(plain);
    plain = "";
    const Tag = TAGS[char as WhatsappMarker];
    nodes.push(
      <Tag key={`${index}-${close}`}>
        {renderWhatsapp(text.slice(index + 1, close))}
      </Tag>,
    );
    index = close + 1;
  }
  if (plain) nodes.push(plain);
  return nodes;
}

/**
 * Wraps the selection in `marker` (or removes it when the selection is already wrapped). Spaces at
 * the edges of the selection stay outside, since WhatsApp ignores `* bold *`. With nothing
 * selected, inserts the pair and puts the caret between.
 */
export function toggleMarker(
  value: string,
  start: number,
  end: number,
  marker: WhatsappMarker,
): { value: string; start: number; end: number } {
  let from = start;
  let to = end;
  while (from < to && /\s/u.test(value[from]!)) from += 1;
  while (to > from && /\s/u.test(value[to - 1]!)) to -= 1;
  if (value[from - 1] === marker && value[to] === marker && from < to) {
    return {
      value:
        value.slice(0, from - 1) + value.slice(from, to) + value.slice(to + 1),
      start: from - 1,
      end: to - 1,
    };
  }
  return {
    value:
      value.slice(0, from) +
      marker +
      value.slice(from, to) +
      marker +
      value.slice(to),
    start: from + 1,
    end: to + 1,
  };
}
