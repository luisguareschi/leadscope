import type { LoadedCompany } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { extractKnowledgeText, KnowledgeExtractionError } from "../../integrations/knowledge/extract-text.js";
import { sha256Hex } from "../../lib/crypto.js";
import { HttpError } from "../../lib/http-error.js";

export type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

export type PreparedKnowledgeFile = {
  name: string;
  nameKey: string;
  format: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  text: string;
  charCount: number;
};

const formatNumber = (value: number) => new Intl.NumberFormat("es-UY").format(value);
const megabytes = (bytes: number) => `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;

export function cleanFilename(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? raw;
  return base.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "archivo";
}

/** Extracts the text and checks the per-file limits. Nothing is stored yet. */
export async function prepareKnowledgeFile(
  company: LoadedCompany,
  file: UploadedFile | undefined,
): Promise<PreparedKnowledgeFile> {
  if (!file) throw new HttpError(400, "Elegí un archivo para subir.", "missing_file");
  const limits = company.config.knowledge;
  if (file.size > limits.maxFileBytes) {
    throw new HttpError(413, `El archivo supera el máximo de ${megabytes(limits.maxFileBytes)}.`, "file_too_large");
  }
  const name = cleanFilename(file.originalname);
  let extracted;
  try {
    extracted = await extractKnowledgeText(name, file.buffer);
  } catch (error) {
    if (error instanceof KnowledgeExtractionError) {
      throw new HttpError(error.code === "unsupported_format" ? 415 : 422, error.message, error.code);
    }
    throw error;
  }
  if (extracted.text.length > limits.maxCharsPerFile) {
    throw new HttpError(
      422,
      `El archivo tiene ${formatNumber(extracted.text.length)} caracteres de texto y el máximo por archivo es ${formatNumber(limits.maxCharsPerFile)}. Dividilo o quitá lo que el asistente no necesita.`,
      "file_text_too_long",
    );
  }
  return {
    name,
    nameKey: name.toLowerCase(),
    format: extracted.format,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: file.size,
    sha256: sha256Hex(file.buffer),
    text: extracted.text,
    charCount: extracted.text.length,
  };
}

/** Rejects the upload if all the company's files together would no longer fit in the prompt. */
export async function assertFitsCompanyTotal(
  ctx: AppContext,
  company: LoadedCompany,
  charCount: number,
  replacingId: string | null,
): Promise<void> {
  const others = await ctx.db.knowledgeFile.aggregate({
    where: { companyId: company.id, ...(replacingId ? { NOT: { id: replacingId } } : {}) },
    _sum: { charCount: true },
  });
  const used = others._sum.charCount ?? 0;
  const limit = company.config.knowledge.maxCharsTotal;
  if (used + charCount > limit) {
    throw new HttpError(
      422,
      `Con este archivo el conocimiento llegaría a ${formatNumber(used + charCount)} caracteres y el máximo es ${formatNumber(limit)}. Borrá o achicá otros archivos primero.`,
      "company_text_limit",
    );
  }
}
