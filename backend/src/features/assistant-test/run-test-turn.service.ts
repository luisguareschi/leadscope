import type { CompanyConfig } from "../../companies/company-config.js";
import {
  loadCompanyById,
  type LoadedCompany,
} from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { callModel } from "../../conversation/process-thread.js";
import { loadSystemPrompt } from "../../conversation/system-prompt.js";
import { rulesFor } from "../../conversation/turn-rules.js";
import { buildChatTurns } from "../../engine/history.js";
import type { PromptThread } from "../../engine/prompt.js";
import { decideTurn } from "../../engine/turn.js";
import type {
  Collected,
  Intent,
  LeadStage,
  ThreadState,
} from "../../engine/types.js";
import { MissingIntegrationError } from "../../integrations/registry.js";
import { conflict } from "../../lib/http-error.js";
import type { LlmClient } from "../../llm/types.js";

export type TestLead = {
  state: ThreadState;
  stage: LeadStage;
  collected: Collected;
  callTime: string | null;
  summary: string | null;
};

export type TestDraftOverride = {
  companyName?: string;
  config?: CompanyConfig;
  instructions?: string;
};

export type TestTurnRequest = {
  messages: Array<{ role: "lead" | "assistant"; body: string }>;
  lead?: TestLead;
  leadName?: string | null;
  /** Unsaved Configuración draft to test before publishing to production. */
  draft?: TestDraftOverride;
};

export type TestTurnResponse = {
  reply: string;
  /** Separate WhatsApp bubbles to send in order. */
  replies: string[];
  /** The model's own words when the lead would get a fixed line instead. */
  modelReply: string | null;
  /** Public files from Conocimiento that the assistant would send on this turn. */
  sentFiles: Array<{ id: string; path: string; format: string }>;
  lead: TestLead;
  model: {
    intent: Intent;
    callNow: boolean;
    needsHuman: boolean;
    forbiddenTopic: string | null;
  } | null;
  /** Why the real assistant would stop here and wait for a person. */
  stoppedReason: string | null;
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
  } | null;
};

const NEW_LEAD: TestLead = {
  state: "greeting",
  stage: "qualifying",
  collected: {},
  callTime: null,
  summary: null,
};

/**
 * One turn of the panel's test chat (Probar asistente): runs the company's saved settings (or an
 * unsaved draft override) and knowledge through the exact same prompt and turn engine as WhatsApp.
 * Nothing is stored except the Anthropic usage, and nothing reaches WhatsApp or HubSpot.
 */
export async function runTestTurn(
  ctx: AppContext,
  companyId: string,
  request: TestTurnRequest,
): Promise<TestTurnResponse> {
  const savedCompany = await loadCompanyById(
    ctx.db,
    companyId,
    ctx.encryptionKey,
  );
  const company: LoadedCompany = request.draft
    ? {
        ...savedCompany,
        name: request.draft.companyName ?? savedCompany.name,
        config: request.draft.config ?? savedCompany.config,
        instructions: request.draft.instructions ?? savedCompany.instructions,
      }
    : savedCompany;

  let llm: LlmClient;
  try {
    llm = ctx.integrations.llmFor(company);
  } catch (error) {
    if (!(error instanceof MissingIntegrationError)) throw error;
    throw conflict(
      "Configura la clave de Anthropic en Configuración → Integraciones → Anthropic para probar el asistente.",
      "anthropic_missing",
    );
  }

  const keys = new Set(company.config.collect.map((item) => item.key));
  const lead = request.lead ?? NEW_LEAD;
  // Items removed from the config since the test started are dropped, as the prompt ignores them.
  const collected = Object.fromEntries(
    Object.entries(lead.collected).filter(([key]) => keys.has(key)),
  );
  const thread: PromptThread = {
    ...lead,
    collected,
    stageChangedByEmail: null,
    name: request.leadName?.trim() || null,
    source: "whatsapp",
  };

  const { system, documents, sendableFiles } = await loadSystemPrompt(
    ctx,
    company,
  );
  const { config } = company;
  const { input, usage } = await callModel(ctx, llm, company, {
    thread,
    threadId: null,
    system,
    documents,
    sendableFiles,
    messages: buildChatTurns(
      request.messages.map((message) => ({
        direction: message.role === "lead" ? "inbound" : "outbound",
        type: "text",
        body: message.body,
        sentByEmail: null,
      })),
      config.llm.historyLimit,
      thread.source,
    ),
  });
  const decision = decideTurn(thread, input, rulesFor(company));
  if (usage) {
    // The model already answered: a failed usage write must not cost the reply, or a retry.
    await ctx.db.llmUsage
      .create({ data: { companyId: company.id, threadId: null, ...usage } })
      .catch((error: unknown) =>
        ctx.logger.error(
          { err: error, companyId: company.id },
          "test turn usage not recorded",
        ),
      );
  }

  const sendableById = new Map(sendableFiles.map((file) => [file.id, file]));
  const sentFiles = decision.sendFileIds
    .map((id) => sendableById.get(id))
    .filter((file): file is NonNullable<typeof file> => Boolean(file))
    .map(({ id, path, format }) => ({ id, path, format }));

  const output = input.kind === "model" ? input.output : null;
  // The lead gets a fixed line whenever the turn stops the assistant, even if the model's own
  // text happened to match it.
  const modelReply =
    output && decision.needsHuman ? output.reply.trim() || null : null;
  return {
    reply: decision.reply,
    replies: decision.replies,
    modelReply,
    sentFiles,
    lead: {
      state: decision.state,
      stage: decision.stage,
      collected: decision.fields.collected,
      callTime: decision.fields.callTime,
      summary: decision.summary,
    },
    model: output
      ? {
          intent: output.intent,
          callNow: output.callNow,
          needsHuman: output.needsHuman,
          forbiddenTopic: output.forbiddenTopic,
        }
      : null,
    stoppedReason: decision.needsHuman?.reason ?? null,
    usage: usage
      ? {
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          latencyMs: usage.latencyMs,
        }
      : null,
  };
}
