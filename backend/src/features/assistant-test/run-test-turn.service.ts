import { loadCompanyById } from "../../companies/load-company.js";
import type { AppContext } from "../../context.js";
import { callModel } from "../../conversation/process-thread.js";
import { loadSystemPrompt } from "../../conversation/system-prompt.js";
import { rulesFor } from "../../conversation/turn-rules.js";
import { capReply } from "../../engine/guardrails.js";
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

export type TestTurnRequest = {
  messages: Array<{ role: "lead" | "assistant"; body: string }>;
  lead?: TestLead;
  leadName?: string | null;
};

export type TestTurnResponse = {
  reply: string;
  /** The model's own words when the lead would get a fixed line instead. */
  modelReply: string | null;
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
 * One turn of the panel's test chat (Probar asistente): the company's saved prompt, knowledge, and
 * turn rules, exactly as on WhatsApp, for a lead whose conversation and state the browser keeps.
 * Nothing is stored except the Anthropic usage (the company pays for it like any other turn), and
 * nothing reaches WhatsApp or HubSpot.
 */
export async function runTestTurn(
  ctx: AppContext,
  companyId: string,
  request: TestTurnRequest,
): Promise<TestTurnResponse> {
  const company = await loadCompanyById(ctx.db, companyId, ctx.encryptionKey);
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

  const { system, documents } = await loadSystemPrompt(ctx, company);
  const { config } = company;
  const { input, usage } = await callModel(ctx, llm, company, {
    thread,
    threadId: null,
    system,
    documents,
    messages: buildChatTurns(
      request.messages.map((message) => ({
        direction: message.role === "lead" ? "inbound" : "outbound",
        type: "text",
        body: message.body,
        sentByEmail: null,
      })),
      config.llm.historyLimit,
    ),
  });
  const decision = decideTurn(thread, input, rulesFor(company));
  if (usage) {
    await ctx.db.llmUsage.create({
      data: { companyId: company.id, threadId: null, ...usage },
    });
  }

  const output = input.kind === "model" ? input.output : null;
  const modelReply =
    output && decision.reply !== capReply(output.reply, config.maxReplyChars)
      ? output.reply.trim() || null
      : null;
  return {
    reply: decision.reply,
    modelReply,
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
