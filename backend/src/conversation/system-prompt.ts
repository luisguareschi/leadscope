import type { LoadedCompany } from "../companies/load-company.js";
import type { AppContext } from "../context.js";
import { buildSystemPrompt, type KnowledgeDocument } from "../engine/prompt.js";

/** The cached system block for a company's next turn. The settings preview shows this same text. */
export async function loadSystemPrompt(
  ctx: AppContext,
  company: LoadedCompany,
): Promise<{ system: string; documents: KnowledgeDocument[] }> {
  const documents = await ctx.db.knowledgeFile.findMany({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
    select: { name: true, updatedAt: true, text: true },
  });
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
