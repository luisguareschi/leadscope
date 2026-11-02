import type { LoadedCompany } from "../companies/load-company.js";
import type { AppContext } from "../context.js";
import { knowledgeDocuments } from "../engine/knowledge-tree.js";
import { buildSystemPrompt, type KnowledgeDocument } from "../engine/prompt.js";

/** The cached system block for a company's next turn. The settings preview shows this same text. */
export async function loadSystemPrompt(
  ctx: AppContext,
  company: LoadedCompany,
): Promise<{ system: string; documents: KnowledgeDocument[] }> {
  const [folders, files] = await Promise.all([
    ctx.db.knowledgeFolder.findMany({
      where: { companyId: company.id },
      select: { id: true, parentId: true, name: true },
    }),
    ctx.db.knowledgeFile.findMany({
      where: { companyId: company.id },
      select: {
        id: true,
        folderId: true,
        name: true,
        updatedAt: true,
        text: true,
      },
    }),
  ]);
  const documents = knowledgeDocuments(folders, files);
  return {
    system: buildSystemPrompt({
      config: company.config,
      companyName: company.name,
      instructions: company.instructions,
      documents,
    }),
    documents,
  };
}
