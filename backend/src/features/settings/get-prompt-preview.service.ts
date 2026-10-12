import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { loadSystemPrompt } from "../../conversation/system-prompt.js";
import { buildTurnContext, type PromptThread } from "../../engine/prompt.js";
import { SUBMIT_TURN_TOOL } from "../../llm/anthropic.js";

/** The turn context is per lead; the preview shows it for someone writing for the first time. */
const FIRST_MESSAGE_LEAD: PromptThread = {
  state: "greeting",
  interest: null,
  budget: null,
  knowsProjects: null,
  callTime: null,
  name: null,
  source: "whatsapp",
};

/** What the model receives on the company's next turn, from the saved settings and files. */
export async function getPromptPreview(ctx: AppContext, companyId: string) {
  const company = await loadCompanyById(ctx.db, companyId, ctx.encryptionKey);
  const { system, documents } = await loadSystemPrompt(ctx, company);
  return {
    model: company.config.llm.model,
    system,
    turnContext: buildTurnContext(
      FIRST_MESSAGE_LEAD,
      company.config,
      ctx.now(),
    ),
    tool: SUBMIT_TURN_TOOL,
    knowledge: {
      files: documents.length,
      chars: documents.reduce((sum, doc) => sum + doc.text.length, 0),
    },
  };
}
