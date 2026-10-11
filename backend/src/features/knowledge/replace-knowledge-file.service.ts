import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import type { OperatorAuth } from "../../http/require-operator.js";
import { HttpError, notFound } from "../../lib/http-error.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";
import { assertFitsCompanyTotal, prepareKnowledgeFile, type UploadedFile } from "./prepare-upload.js";

/** Swaps a specific file for a new version, which may have a different name. */
export async function replaceKnowledgeFile(
  ctx: AppContext,
  operator: OperatorAuth,
  fileId: string,
  file: UploadedFile | undefined,
) {
  const current = await ctx.db.knowledgeFile.findFirst({ where: { id: fileId, companyId: operator.companyId } });
  if (!current) throw notFound("Archivo no encontrado");
  const company = await loadCompanyById(ctx.db, operator.companyId, ctx.encryptionKey);
  const prepared = await prepareKnowledgeFile(company, file);
  if (prepared.nameKey !== current.nameKey) {
    const clash = await ctx.db.knowledgeFile.findUnique({
      where: { companyId_nameKey: { companyId: company.id, nameKey: prepared.nameKey } },
    });
    if (clash) throw new HttpError(409, `Ya hay otro archivo llamado "${clash.name}".`, "name_taken");
  }
  await assertFitsCompanyTotal(ctx, company, prepared.charCount, current.id);

  const saved = await ctx.db.knowledgeFile.update({
    where: { id: current.id },
    data: { uploadedById: operator.operatorId, ...prepared },
    include: { uploadedBy: { select: { email: true } } },
  });
  return { file: toKnowledgeFileDto(saved), replaced: true };
}
