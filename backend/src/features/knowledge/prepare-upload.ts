import type { LoadedCompany } from "../../companies/load-company.js";
import {
  extractKnowledgeText,
  KnowledgeExtractionError,
} from "../../integrations/knowledge/extract-text.js";
import {
  formatFromFilename,
  isMediaOnlyFormat,
  matchesContainer,
  type KnowledgeFormat,
} from "../../integrations/knowledge/formats.js";
import { sha256Hex } from "../../lib/crypto.js";
import { HttpError } from "../../lib/http-error.js";
import type { KnowledgeTx } from "./knowledge-folders.js";

export type KnowledgeVisibility = "internal" | "public";

export type UploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

export type PreparedKnowledgeFile = {
  name: string;
  nameKey: string;
  format: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  text: string;
  charCount: number;
  visibility: KnowledgeVisibility;
  buffer: Buffer;
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("es").format(value);
const megabytes = (bytes: number) =>
  `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

/** WhatsApp Cloud API accepts JPEG and PNG up to 5 MB for `type: "image"`. */
export const MAX_WHATSAPP_IMAGE_BYTES = 5 * 1024 * 1024;
const WHATSAPP_NATIVE_IMAGE_MIMES = new Set(["image/jpeg", "image/png"]);

/**
 * Formats allowed as direct manual attachments from the panel composer. Excludes active/scriptable
 * formats such as HTML and SVG.
 */
const MANUAL_ATTACHMENT_FORMATS = new Set<KnowledgeFormat>([
  "pdf",
  "jpg",
  "png",
  "webp",
  "docx",
  "doc",
  "odt",
  "pptx",
  "xlsx",
  "xls",
  "ods",
  "csv",
  "txt",
  "md",
]);

export const MIME_BY_FORMAT: Record<KnowledgeFormat, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  odt: "application/vnd.oasis.opendocument.text",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv",
  txt: "text/plain",
  md: "text/markdown",
  html: "text/html",
  json: "application/json",
};

/**
 * WhatsApp Cloud API only accepts `image/jpeg` and `image/png` (<= 5 MB) for `type: "image"`.
 * WebP and larger images must be sent as `type: "document"`.
 */
export function whatsappMediaKind(
  mimeType: string,
  sizeBytes: number,
): "image" | "document" {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  return WHATSAPP_NATIVE_IMAGE_MIMES.has(base) &&
    sizeBytes <= MAX_WHATSAPP_IMAGE_BYTES
    ? "image"
    : "document";
}

/** Validates a direct file uploaded from the panel composer (extension allowlist + magic bytes). */
export function validateManualAttachment(file: UploadedFile): {
  fileName: string;
  format: KnowledgeFormat;
  mimeType: string;
} {
  const fileName = cleanFilename(file.originalname);
  const format = formatFromFilename(fileName);
  if (!format || !MANUAL_ATTACHMENT_FORMATS.has(format)) {
    throw new HttpError(
      415,
      "Formato de archivo no compatible para envío. Usa PDF, JPG, PNG, WebP, Word, Excel, PowerPoint, CSV o texto.",
      "unsupported_format",
    );
  }
  if (file.buffer.length === 0 || !matchesContainer(format, file.buffer)) {
    throw new HttpError(
      422,
      "El archivo está dañado o no coincide con su extensión.",
      "corrupt_file",
    );
  }
  return {
    fileName,
    format,
    mimeType: MIME_BY_FORMAT[format],
  };
}

export function cleanFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  return (
    base
      // eslint-disable-next-line no-control-regex -- drop ASCII control characters from filenames
      .replace(/[\u0000-\u001f]/g, "")
      .trim()
      .slice(0, 200) || "archivo"
  );
}

/** Extracts text (if applicable) and checks limits. Images automatically become `public`. */
export async function prepareKnowledgeFile(
  company: LoadedCompany,
  file: UploadedFile | undefined,
  requestedVisibility?: KnowledgeVisibility,
): Promise<PreparedKnowledgeFile> {
  if (!file)
    throw new HttpError(400, "Elige un archivo para subir.", "missing_file");
  const limits = company.config.knowledge;
  if (file.size > limits.maxFileBytes) {
    throw new HttpError(
      413,
      `El archivo supera el máximo de ${megabytes(limits.maxFileBytes)}.`,
      "file_too_large",
    );
  }
  const name = cleanFilename(file.originalname);
  const detected = formatFromFilename(name);
  const mediaOnly = detected ? isMediaOnlyFormat(detected) : false;
  if (mediaOnly && requestedVisibility === "internal") {
    throw new HttpError(
      422,
      "Las imágenes no tienen texto para el conocimiento interno; súbelas como archivos públicos para enviar a leads.",
      "media_requires_public",
    );
  }
  const visibility: KnowledgeVisibility = mediaOnly
    ? "public"
    : (requestedVisibility ?? "internal");

  let extracted;
  try {
    extracted = await extractKnowledgeText(name, file.buffer, {
      allowEmptyText: visibility === "public",
    });
  } catch (error) {
    if (error instanceof KnowledgeExtractionError) {
      throw new HttpError(
        error.code === "unsupported_format" ? 415 : 422,
        error.message,
        error.code,
      );
    }
    throw error;
  }
  if (extracted.text.length > limits.maxCharsPerFile) {
    throw new HttpError(
      422,
      `El archivo tiene ${formatNumber(extracted.text.length)} caracteres de texto y el máximo por archivo es ${formatNumber(limits.maxCharsPerFile)}. Divídelo o quita lo que el asistente no necesita.`,
      "file_text_too_long",
    );
  }
  return {
    name,
    nameKey: name.toLowerCase(),
    format: extracted.format,
    mimeType:
      MIME_BY_FORMAT[extracted.format as KnowledgeFormat] ??
      "application/octet-stream",
    sizeBytes: file.size,
    sha256: sha256Hex(file.buffer),
    text: extracted.text,
    charCount: extracted.text.length,
    visibility,
    buffer: file.buffer,
  };
}

/** Rejects the upload if all the company's files together would no longer fit in the prompt. */
export async function assertFitsCompanyTotal(
  tx: KnowledgeTx,
  company: LoadedCompany,
  charCount: number,
  replacingId: string | null,
): Promise<void> {
  if (charCount === 0) return;
  const others = await tx.knowledgeFile.aggregate({
    where: {
      companyId: company.id,
      ...(replacingId ? { NOT: { id: replacingId } } : {}),
    },
    _sum: { charCount: true },
  });
  const used = others._sum.charCount ?? 0;
  const limit = company.config.knowledge.maxCharsTotal;
  if (used + charCount > limit) {
    throw new HttpError(
      422,
      `Con este archivo el conocimiento llegaría a ${formatNumber(used + charCount)} caracteres y el máximo es ${formatNumber(limit)}. Borra o acorta otros archivos primero.`,
      "company_text_limit",
    );
  }
}
