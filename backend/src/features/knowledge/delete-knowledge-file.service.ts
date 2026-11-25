import type { AppContext } from "../../context.js";
import { removeStorageIfUnreferenced } from "../../integrations/storage/cleanup.js";
import { notFound } from "../../lib/http-error.js";

export async function deleteKnowledgeFile(
  ctx: AppContext,
  companyId: string,
  fileId: string,
): Promise<void> {
  const file = await ctx.db.knowledgeFile.findFirst({
    where: { id: fileId, companyId },
    select: { id: true, storagePath: true },
  });
  if (!file) throw notFound("Archivo no encontrado");
  await ctx.db.knowledgeFile.delete({ where: { id: file.id } });
  if (file.storagePath) {
    await removeStorageIfUnreferenced(ctx, [file.storagePath]);
  }
}
