/**
 * Edits for the instructions Markdown field. Pure string operations: the textarea stores the
 * returned text and puts the selection back on `start`/`end`.
 */

export type MarkdownMarker = "**" | "_";
export type MarkdownLineKind = "h1" | "h2" | "h3" | "bullet" | "numbered";

const FIXED_PREFIX: Record<Exclude<MarkdownLineKind, "numbered">, string> = {
  h1: "# ",
  h2: "## ",
  h3: "### ",
  bullet: "- ",
};

export type MarkdownEdit = {
  value: string;
  start: number;
  end: number;
};

/** A heading, bullet, or ordered-list marker at the start of a line, including the trailing space. */
const LINE_PREFIX = /^(?:#{1,6} |[-*+] |\d+\. )/;

function clampRange(
  length: number,
  start: number,
  end: number,
): [number, number] {
  const from = Math.max(0, Math.min(start, length));
  const to = Math.max(from, Math.min(end, length));
  return [from, to];
}

/**
 * Wraps the selection in `marker`, or removes one layer when that marker already surrounds it
 * (immediately outside the selection, or as the selection's own edges). With nothing selected,
 * inserts the pair and leaves the caret between.
 */
export function toggleWrap(
  value: string,
  start: number,
  end: number,
  marker: MarkdownMarker,
): MarkdownEdit {
  const [from, to] = clampRange(value.length, start, end);
  const size = marker.length;
  if (from === to) {
    return {
      value: value.slice(0, from) + marker + marker + value.slice(to),
      start: from + size,
      end: from + size,
    };
  }
  const around =
    (from >= size ? value.slice(from - size, from) : "") === marker &&
    value.slice(to, to + size) === marker;
  if (around) {
    return {
      value:
        value.slice(0, from - size) +
        value.slice(from, to) +
        value.slice(to + size),
      start: from - size,
      end: to - size,
    };
  }
  const inside =
    to - from >= size * 2 &&
    value.slice(from, from + size) === marker &&
    value.slice(to - size, to) === marker;
  if (inside) {
    return {
      value:
        value.slice(0, from) +
        value.slice(from + size, to - size) +
        value.slice(to),
      start: from,
      end: to - size * 2,
    };
  }
  return {
    value:
      value.slice(0, from) +
      marker +
      value.slice(from, to) +
      marker +
      value.slice(to),
    start: from + size,
    end: to + size,
  };
}

function lineBounds(
  value: string,
  start: number,
  end: number,
): [number, number] {
  const from = value.lastIndexOf("\n", start - 1) + 1;
  // A selection that ends on a newline has not entered the next line.
  const scan = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const newline = value.indexOf("\n", scan);
  return [from, newline === -1 ? value.length : newline];
}

function hasPrefix(line: string, kind: MarkdownLineKind): boolean {
  if (kind === "numbered") return /^\d+\. /.test(line);
  return line.startsWith(FIXED_PREFIX[kind]);
}

function prefixFor(kind: MarkdownLineKind, index: number): string {
  return kind === "numbered" ? `${index + 1}. ` : FIXED_PREFIX[kind];
}

function stripPrefix(line: string, kind: MarkdownLineKind): string {
  if (kind === "numbered") return line.replace(/^\d+\. /, "");
  const prefix = FIXED_PREFIX[kind];
  return line.startsWith(prefix) ? line.slice(prefix.length) : line;
}

/**
 * Adds or removes a line prefix on every line the selection touches. When every non-blank line
 * already has that prefix, it comes off; otherwise it goes on, replacing a heading or list prefix
 * already on the line (`- foo` becomes `1. foo`, not `- 1. foo`). Blank lines stay blank unless
 * the selection is only blank lines, so a list can be toggled off across a gap. The returned
 * selection covers those same lines.
 */
export function toggleLinePrefix(
  value: string,
  start: number,
  end: number,
  kind: MarkdownLineKind,
): MarkdownEdit {
  const [selStart, selEnd] = clampRange(value.length, start, end);
  const [from, to] = lineBounds(value, selStart, selEnd);
  const lines = value.slice(from, to).split("\n");
  const content = lines.filter((line) => line.trim() !== "");
  const remove =
    content.length > 0 && content.every((line) => hasPrefix(line, kind));
  let number = 0;
  const nextLines = lines.map((line) => {
    if (line.trim() === "") {
      return content.length === 0 ? prefixFor(kind, number++) : line;
    }
    if (remove) return stripPrefix(line, kind);
    return prefixFor(kind, number++) + line.replace(LINE_PREFIX, "");
  });
  const block = nextLines.join("\n");
  return {
    value: value.slice(0, from) + block + value.slice(to),
    start: from,
    end: from + block.length,
  };
}
