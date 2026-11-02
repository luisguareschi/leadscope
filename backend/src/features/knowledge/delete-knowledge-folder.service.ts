import type { AppContext } from "../../context.js";
import { isSameOrInside } from "../../engine/knowledge-tree.js";
import { notFound } from "../../lib/http-error.js";
import { loadFolders, withKnowledgeLock } from "./knowledge-folders.js";

/** Deletes a folder and everything inside it (subfolders and files, by cascade). */
export async function deleteKnowledgeFolder(
  ctx: AppContext,
  companyId: string,
  folderId: string,
) {
  return withKnowledgeLock(ctx, companyId, async (tx) => {
    const folders = await loadFolders(tx, companyId);
    if (!folders.has(folderId)) throw notFound("Carpeta no encontrada");
    const inside = [...folders.keys()].filter((id) =>
      isSameOrInside(folders, folderId, id),
    );
    const deletedFiles = await tx.knowledgeFile.count({
      where: { companyId, folderId: { in: inside } },
    });
    await tx.knowledgeFolder.delete({ where: { id: folderId } });
    return { deletedFolders: inside.length, deletedFiles };
  });
}
