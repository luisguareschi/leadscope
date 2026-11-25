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
  let storagePaths: string[] = [];
  const result = await withKnowledgeLock(ctx, companyId, async (tx) => {
    const folders = await loadFolders(tx, companyId);
    if (!folders.has(folderId)) throw notFound("Carpeta no encontrada");
    const inside = [...folders.keys()].filter((id) =>
      isSameOrInside(folders, folderId, id),
    );
    const files = await tx.knowledgeFile.findMany({
      where: { companyId, folderId: { in: inside } },
      select: { storagePath: true },
    });
    storagePaths = files
      .map((f) => f.storagePath)
      .filter((path): path is string => Boolean(path));
    await tx.knowledgeFolder.delete({ where: { id: folderId } });
    return { deletedFolders: inside.length, deletedFiles: files.length };
  });
  if (storagePaths.length > 0) {
    await ctx.storage.remove(storagePaths).catch(() => undefined);
  }
  return result;
}
