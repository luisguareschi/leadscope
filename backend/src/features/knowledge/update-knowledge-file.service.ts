import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";
import {
  assertFileNameFree,
  assertFolder,
  loadFolders,
  renamedFileName,
  withKnowledgeLock,
} from "./knowledge-folders.js";

/**
 * Renames a file (it keeps its extension) or moves it to another folder (null is the root). Its
 * date stays the one of its content, which the prompt shows as `updated`.
 */
export async function updateKnowledgeFile(
  ctx: AppContext,
  companyId: string,
  fileId: string,
  change: { name?: string; folderId?: string | null },
) {
  return withKnowledgeLock(ctx, companyId, async (tx) => {
    const current = await tx.knowledgeFile.findFirst({
      where: { id: fileId, companyId },
    });
    if (!current) throw notFound("Archivo no encontrado");
    const folders = await loadFolders(tx, companyId);
    const folderId =
      change.folderId === undefined ? current.folderId : change.folderId;
    assertFolder(folders, folderId);
    const name =
      change.name === undefined
        ? current.name
        : renamedFileName(current.name, change.name);
    const nameKey = name.toLowerCase();
    if (nameKey !== current.nameKey || folderId !== current.folderId) {
      await assertFileNameFree(tx, folders, {
        companyId,
        folderId,
        nameKey,
        exceptId: current.id,
      });
    }
    const saved = await tx.knowledgeFile.update({
      where: { id: current.id },
      data: { name, nameKey, folderId, updatedAt: current.updatedAt },
      include: { uploadedBy: { select: { email: true } } },
    });
    return { file: toKnowledgeFileDto(saved) };
  });
}
