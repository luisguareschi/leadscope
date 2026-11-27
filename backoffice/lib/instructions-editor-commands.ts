export type InstructionsEditorMode = "visual" | "markdown";

export type SlashCommandId =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "horizontalRule"
  | "codeBlock";

export type SlashCommandItem = {
  id: SlashCommandId;
  label: string;
  description: string;
  shortcut: string;
  keywords: readonly string[];
};

export const SLASH_COMMANDS: readonly SlashCommandItem[] = [
  {
    id: "paragraph",
    label: "Texto",
    description: "Párrafo de texto normal",
    shortcut: "P",
    keywords: ["texto", "parrafo", "normal", "paragraph", "text", "p"],
  },
  {
    id: "heading1",
    label: "Título 1",
    description: "Encabezado principal de sección",
    shortcut: "#",
    keywords: ["titulo", "encabezado", "h1", "heading", "1"],
  },
  {
    id: "heading2",
    label: "Título 2",
    description: "Subtítulo para organizar temas",
    shortcut: "##",
    keywords: ["titulo", "subtitulo", "encabezado", "h2", "heading", "2"],
  },
  {
    id: "heading3",
    label: "Título 3",
    description: "Sección secundaria o detalle",
    shortcut: "###",
    keywords: ["titulo", "subtitulo", "encabezado", "h3", "heading", "3"],
  },
  {
    id: "bulletList",
    label: "Lista con viñetas",
    description: "Lista simple de puntos",
    shortcut: "-",
    keywords: ["lista", "vinetas", "puntos", "bullet", "ul", "list"],
  },
  {
    id: "orderedList",
    label: "Lista numerada",
    description: "Pasos o reglas en orden",
    shortcut: "1.",
    keywords: ["lista", "numerada", "pasos", "orden", "ordered", "ol", "1"],
  },
  {
    id: "blockquote",
    label: "Cita",
    description: "Resalta una nota o ejemplo",
    shortcut: ">",
    keywords: ["cita", "nota", "ejemplo", "quote", "blockquote"],
  },
  {
    id: "horizontalRule",
    label: "Separador",
    description: "Línea horizontal entre bloques",
    shortcut: "---",
    keywords: ["separador", "divisor", "linea", "hr", "divider", "rule"],
  },
  {
    id: "codeBlock",
    label: "Bloque de código",
    description: "Texto literal o plantilla fija",
    shortcut: "```",
    keywords: ["codigo", "plantilla", "literal", "code", "pre"],
  },
];

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function filterSlashCommands(
  query: string,
): readonly SlashCommandItem[] {
  const needle = normalizeSearchText(query);
  if (!needle) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((item) => {
    if (normalizeSearchText(item.label).includes(needle)) return true;
    if (normalizeSearchText(item.description).includes(needle)) return true;
    if (item.shortcut.toLowerCase().includes(needle)) return true;
    return item.keywords.some((keyword) =>
      normalizeSearchText(keyword).includes(needle),
    );
  });
}

export function parseStoredEditorMode(
  stored: string | null,
): InstructionsEditorMode | null {
  if (stored === "visual" || stored === "markdown") return stored;
  return null;
}

const ALLOWED_PROTOCOLS = new Set(["https:", "http:", "mailto:", "tel:"]);

export function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || /\s/.test(trimmed) || trimmed.startsWith("//")) return null;

  const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(trimmed);
  let candidate = trimmed;

  if (!hasScheme) {
    if (!trimmed.includes(".")) return null;
    candidate = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return null;
  if (
    (parsed.protocol === "https:" || parsed.protocol === "http:") &&
    !parsed.hostname
  ) {
    return null;
  }
  if (
    (parsed.protocol === "mailto:" || parsed.protocol === "tel:") &&
    !parsed.pathname.trim()
  ) {
    return null;
  }

  return candidate;
}

const MARKDOWN_BLOCK_PATTERN =
  /^(?:#{1,6}\s+\S|[-*+]\s+\S|\d+\.\s+\S|>\s+\S|```)/m;
const MARKDOWN_INLINE_PATTERN =
  /(?:\[[^\]\n]+\]\((?:https?:\/\/|mailto:|tel:)[^)\s]+\)|\*\*[^*\n]+\*\*)/;

export function looksLikeMarkdown(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  return (
    MARKDOWN_BLOCK_PATTERN.test(trimmed) ||
    MARKDOWN_INLINE_PATTERN.test(trimmed)
  );
}
