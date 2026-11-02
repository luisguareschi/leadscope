import type { AppContext } from "../../context.js";
import { toKnowledgeFolderDto } from "./knowledge-dto.js";
import {
  assertFolder,
  assertFolderNameFree,
  cleanName,
  loadFolders,
  MAX_FOLDER_NAME,
  withKnowledgeLock,
} from "./knowledge-folders.js";

/** A new, empty folder inside `parentId` (null is the root). */
export async function createKnowledgeFolder(
  ctx: AppContext,
  companyId: string,
  input: { name: string; parentId: string | null },
) {
  const name = cleanName(input.name, MAX_FOLDER_NAME, "la carpeta");
  return withKnowledgeLock(ctx, companyId, async (tx) => {
    const folders = await loadFolders(tx, companyId);
    assertFolder(folders, input.parentId);
    const nameKey = name.toLowerCase();
    await assertFolderNameFree(tx, folders, {
      companyId,
      parentId: input.parentId,
      nameKey,
    });
    const folder = await tx.knowledgeFolder.create({
      data: { companyId, parentId: input.parentId, name, nameKey },
    });
    return { folder: toKnowledgeFolderDto(folder) };
  });
}
