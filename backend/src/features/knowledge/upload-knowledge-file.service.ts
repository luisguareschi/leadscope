import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";
import {
  assertFolder,
  loadFolders,
  withKnowledgeLock,
} from "./knowledge-folders.js";
import {
  assertFitsCompanyTotal,
  prepareKnowledgeFile,
  type UploadedFile,
} from "./prepare-upload.js";

/**
 * Stores an uploaded file's text in a folder (null is the root). A file with the same name (any
 * case) in that folder replaces the previous version; the same name in another folder is another
 * file.
 */
export async function uploadKnowledgeFile(
  ctx: AppContext,
  access: CompanyAccess,
  folderId: string | null,
  file: UploadedFile | undefined,
) {
  const company = await loadCompanyById(
    ctx.db,
    access.companyId,
    ctx.encryptionKey,
  );
  const prepared = await prepareKnowledgeFile(company, file);
  return withKnowledgeLock(ctx, company.id, async (tx) => {
    assertFolder(await loadFolders(tx, company.id), folderId);
    const existing = await tx.knowledgeFile.findFirst({
      where: { companyId: company.id, folderId, nameKey: prepared.nameKey },
    });
    await assertFitsCompanyTotal(
      tx,
      company,
      prepared.charCount,
      existing?.id ?? null,
    );
    const data = { uploadedById: access.operatorId, ...prepared };
    const saved = existing
      ? await tx.knowledgeFile.update({
          where: { id: existing.id },
          data,
          include: { uploadedBy: { select: { email: true } } },
        })
      : await tx.knowledgeFile.create({
          data: { companyId: company.id, folderId, ...data },
          include: { uploadedBy: { select: { email: true } } },
        });
    return { file: toKnowledgeFileDto(saved), replaced: existing !== null };
  });
}
