import JSZip from "jszip";
import mammoth from "mammoth";
import { extractText as extractPdfText } from "unpdf";
import WordExtractor from "word-extractor";
import * as XLSX from "xlsx";
import { formatFromFilename, matchesContainer, type KnowledgeFormat } from "./formats.js";

export class KnowledgeExtractionError extends Error {
  constructor(
    readonly code: "unsupported_format" | "corrupt_file" | "empty_text",
    message: string,
  ) {
    super(message);
  }
}

/** Decodes plain-text uploads: UTF-8 (with or without BOM), UTF-16 from Excel, or Windows-1252. */
export function decodeText(data: Buffer): string {
  if (data[0] === 0xff && data[1] === 0xfe) return new TextDecoder("utf-16le").decode(data.subarray(2));
  if (data[0] === 0xfe && data[1] === 0xff) return new TextDecoder("utf-16be").decode(data.subarray(2));
  const body = data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf ? data.subarray(3) : data;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return new TextDecoder("windows-1252").decode(body);
  }
}

const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) return String.fromCodePoint(parseInt(entity.slice(2), 16));
    if (entity.startsWith("#")) return String.fromCodePoint(parseInt(entity.slice(1), 10));
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript|head)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6]|section|article|table)>/gi, "\n")
      .replace(/<(td|th)[^>]*>/gi, " | ")
      .replace(/<[^>]+>/g, ""),
  );
}

/** Text of an XML part from an Office or OpenDocument file, keeping paragraph breaks. */
function xmlToText(xml: string, paragraphTag: RegExp): string {
  return decodeEntities(xml.replace(paragraphTag, "\n").replace(/<[^>]+>/g, ""));
}

/** Trims lines, drops control characters, and collapses runs of blank lines. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n\t]+$/gm, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(data: Buffer): Promise<string> {
  const { text } = await extractPdfText(new Uint8Array(data), { mergePages: false });
  return text.join("\n\n");
}

async function extractSpreadsheet(data: Buffer): Promise<string> {
  const workbook = XLSX.read(data, { type: "buffer", cellDates: true, dense: true });
  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const csv = sheet ? XLSX.utils.sheet_to_csv(sheet, { blankrows: false, strip: true }) : "";
    return csv.trim() ? `## Hoja: ${sheetName}\n${csv}` : "";
  })
    .filter(Boolean)
    .join("\n\n");
}

async function extractPptx(data: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const slides = Object.keys(zip.files)
    .map((path) => ({ path, number: Number(/^ppt\/slides\/slide(\d+)\.xml$/.exec(path)?.[1]) }))
    .filter((slide) => Number.isFinite(slide.number))
    .sort((a, b) => a.number - b.number);
  const texts = await Promise.all(
    slides.map(async (slide) => {
      const xml = await zip.file(slide.path)!.async("string");
      return xmlToText(xml, /<\/a:p>/g).trim();
    }),
  );
  return texts.filter(Boolean).join("\n\n");
}

async function extractOdt(data: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file("content.xml")?.async("string");
  if (!xml) throw new Error("content.xml missing");
  return xmlToText(xml, /<\/text:(p|h)>/g);
}

async function extractRaw(format: KnowledgeFormat, data: Buffer): Promise<string> {
  switch (format) {
    case "pdf":
      return extractPdf(data);
    case "docx":
      return (await mammoth.extractRawText({ buffer: data })).value;
    case "doc":
      return (await new WordExtractor().extract(data)).getBody();
    case "odt":
      return extractOdt(data);
    case "pptx":
      return extractPptx(data);
    case "xlsx":
    case "xls":
    case "ods":
      return extractSpreadsheet(data);
    case "html":
      return htmlToText(decodeText(data));
    case "csv":
    case "txt":
    case "md":
    case "json":
      return decodeText(data);
  }
}

export type ExtractedKnowledge = { format: KnowledgeFormat; text: string };

export async function extractKnowledgeText(filename: string, data: Buffer): Promise<ExtractedKnowledge> {
  const format = formatFromFilename(filename);
  if (!format) {
    throw new KnowledgeExtractionError(
      "unsupported_format",
      "Formato no soportado. Subí PDF, Word, Excel, PowerPoint, CSV, texto o Markdown.",
    );
  }
  if (!matchesContainer(format, data)) {
    throw new KnowledgeExtractionError("corrupt_file", "El archivo está dañado o no coincide con su extensión.");
  }
  let raw: string;
  try {
    raw = await extractRaw(format, data);
  } catch {
    throw new KnowledgeExtractionError("corrupt_file", "No pudimos leer el archivo. Probá exportarlo de nuevo.");
  }
  const text = normalizeText(raw);
  if (!text) {
    throw new KnowledgeExtractionError(
      "empty_text",
      format === "pdf"
        ? "El PDF no tiene texto seleccionable (parece escaneado). Subí una versión con texto."
        : "El archivo no tiene texto.",
    );
  }
  return { format, text };
}
