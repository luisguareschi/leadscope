import { PrismaClient } from "@prisma/client";
import { CompanyView } from "../companies/load";
import { extractText, KnowledgeError, safeFilename } from "../integrations/knowledge/extract";

export { KnowledgeError };

export type KnowledgeFileView = {
  id: string;
  filename: string;
  format: string;
  byteSize: number;
  extractedBytes: number;
  createdAt: string;
  updatedAt: string;
};

export type PromptKnowledge = {
  filename: string;
  text: string;
};

export async function listKnowledgeFiles(db: PrismaClient, companyId: string): Promise<KnowledgeFileView[]> {
  const rows = await db.knowledgeFile.findMany({
    where: { companyId },
    orderBy: { filename: "asc" },
  });
  return rows.map(toView);
}

export async function knowledgeForPrompt(db: PrismaClient, companyId: string): Promise<PromptKnowledge[]> {
  const rows = await db.knowledgeFile.findMany({
    where: { companyId },
    orderBy: { filename: "asc" },
    select: { filename: true, extractedText: true },
  });
  return rows.map((row) => ({ filename: row.filename, text: row.extractedText }));
}

export async function uploadKnowledgeFile(
  db: PrismaClient,
  company: CompanyView,
  file: { filename: string; bytes: Buffer },
): Promise<KnowledgeFileView> {
  const filename = safeFilename(file.filename);
  const existing = await db.knowledgeFile.findUnique({
    where: { companyId_filename: { companyId: company.id, filename } },
  });
  return saveKnowledgeFile(db, company, { filename, bytes: file.bytes, replacingId: existing?.id });
}

export async function replaceKnowledgeFile(
  db: PrismaClient,
  company: CompanyView,
  id: string,
  file: { filename: string; bytes: Buffer },
): Promise<KnowledgeFileView> {
  const current = await db.knowledgeFile.findFirst({ where: { id, companyId: company.id } });
  if (!current) throw new KnowledgeError(404, "No se encontró el archivo.");
  const filename = safeFilename(file.filename);
  if (filename !== current.filename) {
    const clash = await db.knowledgeFile.findUnique({
      where: { companyId_filename: { companyId: company.id, filename } },
    });
    if (clash) throw new KnowledgeError(409, "Ya hay un archivo con ese nombre.");
  }
  return saveKnowledgeFile(db, company, { filename, bytes: file.bytes, replacingId: current.id });
}

export async function deleteKnowledgeFile(db: PrismaClient, companyId: string, id: string): Promise<void> {
  const result = await db.knowledgeFile.deleteMany({ where: { id, companyId } });
  if (result.count === 0) throw new KnowledgeError(404, "No se encontró el archivo.");
}

async function saveKnowledgeFile(
  db: PrismaClient,
  company: CompanyView,
  input: { filename: string; bytes: Buffer; replacingId?: string },
): Promise<KnowledgeFileView> {
  const extracted = await extractText(input.filename, input.bytes);
  const extractedBytes = Buffer.byteLength(extracted.text, "utf8");
  const { maxFileBytes, maxCompanyBytes } = company.config.knowledge;
  if (extractedBytes > maxFileBytes) {
    throw new KnowledgeError(413, `El texto extraído supera el límite de ${kb(maxFileBytes)} por archivo.`);
  }
  const rows = await db.knowledgeFile.findMany({
    where: { companyId: company.id },
    select: { id: true, extractedText: true },
  });
  const others = rows
    .filter((row) => row.id !== input.replacingId)
    .reduce((sum, row) => sum + Buffer.byteLength(row.extractedText, "utf8"), 0);
  if (others + extractedBytes > maxCompanyBytes) {
    throw new KnowledgeError(413, `El texto de la empresa superaría el límite de ${kb(maxCompanyBytes)}.`);
  }

  const data = {
    filename: input.filename,
    format: extracted.format,
    extractedText: extracted.text,
    byteSize: input.bytes.length,
  };
  const row = input.replacingId
    ? await db.knowledgeFile.update({ where: { id: input.replacingId }, data })
    : await db.knowledgeFile.create({ data: { companyId: company.id, ...data } });
  return toView(row);
}

function toView(row: {
  id: string;
  filename: string;
  format: string;
  byteSize: number;
  extractedText: string;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeFileView {
  return {
    id: row.id,
    filename: row.filename,
    format: row.format,
    byteSize: row.byteSize,
    extractedBytes: Buffer.byteLength(row.extractedText, "utf8"),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.round(bytes / 1024)} KB`;
}
