import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import { toKnowledgeFileDto } from "./knowledge-dto.js";

/** The file with its extracted text, so an operator can check what the assistant reads. */
export async function getKnowledgeFile(ctx: AppContext, companyId: string, fileId: string) {
  const file = await ctx.db.knowledgeFile.findFirst({
    where: { id: fileId, companyId },
    include: { uploadedBy: { select: { email: true } } },
  });
  if (!file) throw notFound("Archivo no encontrado");
  return { file: { ...toKnowledgeFileDto(file), text: file.text } };
}
