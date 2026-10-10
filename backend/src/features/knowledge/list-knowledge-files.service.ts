import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { ACCEPTED_EXTENSIONS } from "../../integrations/knowledge/formats.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";

export async function listKnowledgeFiles(ctx: AppContext, companyId: string) {
  const [company, files] = await Promise.all([
    loadCompanyById(ctx.db, companyId, ctx.encryptionKey),
    ctx.db.knowledgeFile.findMany({
      where: { companyId },
      orderBy: { updatedAt: "desc" },
      include: { uploadedBy: { select: { email: true } } },
    }),
  ]);
  return {
    files: files.map(toKnowledgeFileDto),
    usage: {
      usedChars: files.reduce((sum, file) => sum + file.charCount, 0),
      ...company.config.knowledge,
    },
    acceptedExtensions: ACCEPTED_EXTENSIONS,
  };
}
