import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { notFound } from "../../lib/http-error.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";
import {
  assertFileNameFree,
  loadFolders,
  withKnowledgeLock,
} from "./knowledge-folders.js";
import {
  assertFitsCompanyTotal,
  prepareKnowledgeFile,
  type UploadedFile,
} from "./prepare-upload.js";
import { knowledgeStoragePath } from "./upload-knowledge-file.service.js";

/** Swaps a specific file for a new version, which may have a different name. It stays in its folder. */
export async function replaceKnowledgeFile(
  ctx: AppContext,
  access: CompanyAccess,
  fileId: string,
  file: UploadedFile | undefined,
) {
  const found = await ctx.db.knowledgeFile.findFirst({
    where: { id: fileId, companyId: access.companyId },
    select: { id: true, visibility: true },
  });
  if (!found) throw notFound("Archivo no encontrado");
  const company = await loadCompanyById(
    ctx.db,
    access.companyId,
    ctx.encryptionKey,
  );
  const prepared = await prepareKnowledgeFile(company, file, found.visibility);
  const { buffer, ...metadata } = prepared;
  const storagePath = knowledgeStoragePath(company.id, metadata.name);
  await ctx.storage.upload(storagePath, buffer, metadata.mimeType);

  let oldStoragePath: string | null = null;
  try {
    const result = await withKnowledgeLock(ctx, company.id, async (tx) => {
      const current = await tx.knowledgeFile.findFirst({
        where: { id: fileId, companyId: company.id },
      });
      if (!current) throw notFound("Archivo no encontrado");
      if (metadata.nameKey !== current.nameKey) {
        await assertFileNameFree(tx, await loadFolders(tx, company.id), {
          companyId: company.id,
          folderId: current.folderId,
          nameKey: metadata.nameKey,
          exceptId: current.id,
        });
      }
      await assertFitsCompanyTotal(tx, company, metadata.charCount, current.id);
      oldStoragePath = current.storagePath ?? null;
      const saved = await tx.knowledgeFile.update({
        where: { id: current.id },
        data: { uploadedById: access.operatorId, ...metadata, storagePath },
        include: { uploadedBy: { select: { email: true } } },
      });
      return { file: toKnowledgeFileDto(saved), replaced: true };
    });
    if (oldStoragePath) {
      await ctx.storage.remove([oldStoragePath]).catch(() => undefined);
    }
    return result;
  } catch (error) {
    await ctx.storage.remove([storagePath]).catch(() => undefined);
    throw error;
  }
}
