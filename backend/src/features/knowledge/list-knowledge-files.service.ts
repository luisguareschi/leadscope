import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { ACCEPTED_EXTENSIONS } from "../../integrations/knowledge/formats.js";
import { toKnowledgeFileDto, toKnowledgeFolderDto } from "./knowledge-dto.js";

/** Every folder and file of the company, flat: each says which folder it is in (null is the root). */
export async function listKnowledgeFiles(ctx: AppContext, companyId: string) {
  const [company, folders, files] = await Promise.all([
    loadCompanyById(ctx.db, companyId, ctx.encryptionKey),
    ctx.db.knowledgeFolder.findMany({
      where: { companyId },
      orderBy: { name: "asc" },
    }),
    ctx.db.knowledgeFile.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: { uploadedBy: { select: { email: true } } },
    }),
  ]);
  return {
    folders: folders.map(toKnowledgeFolderDto),
    files: files.map(toKnowledgeFileDto),
    usage: {
      usedChars: files.reduce((sum, file) => sum + file.charCount, 0),
      ...company.config.knowledge,
    },
    acceptedExtensions: ACCEPTED_EXTENSIONS,
  };
}
