import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";

export async function deleteKnowledgeFile(ctx: AppContext, companyId: string, fileId: string): Promise<void> {
  const deleted = await ctx.db.knowledgeFile.deleteMany({ where: { id: fileId, companyId } });
  if (deleted.count === 0) throw notFound("Archivo no encontrado");
}
