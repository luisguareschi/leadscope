import ExcelJS from "exceljs";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const TEXT_FORMATS = new Set(["txt", "text", "md", "markdown", "csv", "tsv"]);
const ZIP_FORMATS = new Set(["docx", "pptx", "xlsx", "odt"]);

export const ACCEPTED_FORMATS = [...TEXT_FORMATS, ...ZIP_FORMATS, "pdf"].sort();

export class KnowledgeError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "KnowledgeError";
    this.status = status;
  }
}

export function fileFormat(filename: string): string | null {
  const base = filename.split(/[/\\]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return null;
  return base.slice(dot + 1).toLowerCase();
}

export function safeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop()?.replace(/\0/g, "").trim() ?? "";
  if (!base || base === "." || base === "..") {
    throw new KnowledgeError(400, "El nombre del archivo no es válido.");
  }
  if (base.length > 180) {
    throw new KnowledgeError(400, "El nombre del archivo es demasiado largo.");
  }
  return base;
}

export async function extractText(filename: string, bytes: Buffer): Promise<{ format: string; text: string }> {
  const format = fileFormat(filename);
  if (!format || !ACCEPTED_FORMATS.includes(format)) {
    throw new KnowledgeError(
      415,
      "Ese formato no está admitido. Podés subir PDF, DOCX, PPTX, ODT, XLSX, CSV, Markdown o texto plano.",
    );
  }
  const text = (await readFormat(format, bytes)).replace(/\u0000/g, "").trim();
  if (!text) {
    throw new KnowledgeError(422, "No se pudo extraer texto de este archivo.");
  }
  return { format, text };
}

async function readFormat(format: string, bytes: Buffer): Promise<string> {
  if (TEXT_FORMATS.has(format)) return readPlainText(bytes);
  if (format === "pdf") return readPdf(bytes);
  if (format === "docx") return readDocx(bytes);
  if (format === "xlsx") return readXlsx(bytes);
  if (format === "pptx") return readZipXml(bytes, /^ppt\/slides\/slide\d+\.xml$/);
  if (format === "odt") return readZipXml(bytes, /^content\.xml$/);
  throw new KnowledgeError(415, "Ese formato no está admitido.");
}

function readPlainText(bytes: Buffer): string {
  if (bytes.includes(0)) {
    throw new KnowledgeError(415, "Ese archivo no es texto plano.");
  }
  return bytes.toString("utf8");
}

async function readPdf(bytes: Buffer): Promise<string> {
  if (!bytes.subarray(0, 5).toString("latin1").startsWith("%PDF")) {
    throw new KnowledgeError(415, "El archivo no parece un PDF.");
  }
  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    return result.text.replace(/\n*-- \d+ of \d+ --\n*/g, "\n");
  } catch {
    throw new KnowledgeError(422, "No se pudo leer el PDF.");
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function readDocx(bytes: Buffer): Promise<string> {
  assertZip(bytes, "DOCX");
  try {
    const result = await mammoth.extractRawText({ buffer: bytes });
    return result.value;
  } catch {
    throw new KnowledgeError(422, "No se pudo leer el DOCX.");
  }
}

async function readXlsx(bytes: Buffer): Promise<string> {
  assertZip(bytes, "XLSX");
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer);
    const lines: string[] = [];
    workbook.eachSheet((sheet) => {
      lines.push(`# ${sheet.name}`);
      sheet.eachRow((row) => {
        const values = Array.isArray(row.values) ? row.values.slice(1) : [];
        const cells = values.map((value) => cellText(value));
        if (cells.some((cell) => cell !== "")) lines.push(cells.join("\t"));
      });
    });
    return lines.join("\n");
  } catch (err) {
    if (err instanceof KnowledgeError) throw err;
    throw new KnowledgeError(422, "No se pudo leer el XLSX.");
  }
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "text" in value && typeof value.text === "string") return value.text;
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "richText" in value && Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text).join("");
  }
  return "";
}

async function readZipXml(bytes: Buffer, pattern: RegExp): Promise<string> {
  assertZip(bytes, "archivo");
  try {
    const zip = await JSZip.loadAsync(bytes);
    const names = Object.keys(zip.files)
      .filter((name) => pattern.test(name) && !zip.files[name].dir)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const parts: string[] = [];
    for (const name of names) {
      const xml = await zip.files[name].async("string");
      const text = xmlToText(xml);
      if (text) parts.push(text);
    }
    return parts.join("\n\n");
  } catch (err) {
    if (err instanceof KnowledgeError) throw err;
    throw new KnowledgeError(422, "No se pudo leer el archivo.");
  }
}

function assertZip(bytes: Buffer, label: string): void {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new KnowledgeError(415, `El archivo no parece un ${label}.`);
  }
}

function xmlToText(xml: string): string {
  return decodeXml(
    xml
      .replace(/<\/(w:p|a:p|text:p)>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
