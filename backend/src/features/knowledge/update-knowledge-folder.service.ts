import type { AppContext } from "../../context.js";
import { isSameOrInside } from "../../engine/knowledge-tree.js";
import { badRequest, notFound } from "../../lib/http-error.js";
import { toKnowledgeFolderDto } from "./knowledge-dto.js";
import {
  assertFolder,
  assertFolderNameFree,
  cleanName,
  loadFolders,
  MAX_FOLDER_NAME,
  withKnowledgeLock,
} from "./knowledge-folders.js";

/**
 * Renames a folder or moves it, with everything inside, into another folder (null is the root).
 * A folder cannot go into itself or into a folder inside it.
 */
export async function updateKnowledgeFolder(
  ctx: AppContext,
  companyId: string,
  folderId: string,
  change: { name?: string; parentId?: string | null },
) {
  const requestedName =
    change.name === undefined
      ? undefined
      : cleanName(change.name, MAX_FOLDER_NAME, "la carpeta");
  return withKnowledgeLock(ctx, companyId, async (tx) => {
    const folders = await loadFolders(tx, companyId);
    const current = folders.get(folderId);
    if (!current) throw notFound("Carpeta no encontrada");
    const parentId =
      change.parentId === undefined ? current.parentId : change.parentId;
    assertFolder(folders, parentId);
    if (isSameOrInside(folders, folderId, parentId))
      throw badRequest(
        "No podés mover una carpeta adentro de sí misma ni de una de sus subcarpetas.",
        "folder_cycle",
      );
    const name = requestedName ?? current.name;
    const nameKey = name.toLowerCase();
    if (
      nameKey !== current.name.toLowerCase() ||
      parentId !== current.parentId
    ) {
      await assertFolderNameFree(tx, folders, {
        companyId,
        parentId,
        nameKey,
        exceptId: folderId,
      });
    }
    const folder = await tx.knowledgeFolder.update({
      where: { id: folderId },
      data: { name, nameKey, parentId },
    });
    return { folder: toKnowledgeFolderDto(folder) };
  });
}
