import { randomUUID } from "node:crypto";
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
  type KnowledgeVisibility,
  type UploadedFile,
} from "./prepare-upload.js";

export function knowledgeStoragePath(companyId: string, name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
  return `${companyId}/knowledge/${randomUUID()}-${safe}`;
}

/**
 * Stores an uploaded file's text and binary (in Supabase Storage) in a folder (null is the root).
 * A file with the same name (any case) in that folder replaces the previous version.
 */
export async function uploadKnowledgeFile(
  ctx: AppContext,
  access: CompanyAccess,
  folderId: string | null,
  file: UploadedFile | undefined,
  options: {
    visibility?: KnowledgeVisibility;
    description?: string | null;
  } = {},
) {
  const company = await loadCompanyById(
    ctx.db,
    access.companyId,
    ctx.encryptionKey,
  );
  const prepared = await prepareKnowledgeFile(
    company,
    file,
    options.visibility,
  );
  const { buffer, ...metadata } = prepared;
  const storagePath = knowledgeStoragePath(company.id, metadata.name);
  await ctx.storage.upload(storagePath, buffer, metadata.mimeType);

  let oldStoragePath: string | null = null;
  try {
    const result = await withKnowledgeLock(ctx, company.id, async (tx) => {
      assertFolder(await loadFolders(tx, company.id), folderId);
      const existing = await tx.knowledgeFile.findFirst({
        where: { companyId: company.id, folderId, nameKey: metadata.nameKey },
      });
      await assertFitsCompanyTotal(
        tx,
        company,
        metadata.charCount,
        existing?.id ?? null,
      );
      oldStoragePath = existing?.storagePath ?? null;
      const description =
        options.description !== undefined
          ? options.description?.trim() || null
          : (existing?.description ?? null);
      const visibility =
        options.visibility !== undefined
          ? metadata.visibility
          : (existing?.visibility ?? metadata.visibility);
      const data = {
        uploadedById: access.operatorId,
        ...metadata,
        visibility,
        storagePath,
        description,
      };
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
    if (oldStoragePath) {
      await ctx.storage.remove([oldStoragePath]).catch(() => undefined);
    }
    return result;
  } catch (error) {
    await ctx.storage.remove([storagePath]).catch(() => undefined);
    throw error;
  }
}
