import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import type { OperatorAuth } from "../../http/require-operator.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";
import { assertFitsCompanyTotal, prepareKnowledgeFile, type UploadedFile } from "./prepare-upload.js";

/** Stores an uploaded file's text. A file with the same name (any case) replaces the previous version. */
export async function uploadKnowledgeFile(ctx: AppContext, operator: OperatorAuth, file: UploadedFile | undefined) {
  const company = await loadCompanyById(ctx.db, operator.companyId, ctx.encryptionKey);
  const prepared = await prepareKnowledgeFile(company, file);
  const existing = await ctx.db.knowledgeFile.findUnique({
    where: { companyId_nameKey: { companyId: company.id, nameKey: prepared.nameKey } },
  });
  await assertFitsCompanyTotal(ctx, company, prepared.charCount, existing?.id ?? null);

  const saved = await ctx.db.knowledgeFile.upsert({
    where: { companyId_nameKey: { companyId: company.id, nameKey: prepared.nameKey } },
    create: { companyId: company.id, uploadedById: operator.operatorId, ...prepared },
    update: { uploadedById: operator.operatorId, ...prepared },
    include: { uploadedBy: { select: { email: true } } },
  });
  return { file: toKnowledgeFileDto(saved), replaced: existing !== null };
}
