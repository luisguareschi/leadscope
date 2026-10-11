import type { CompanyConfig } from "../companies/company-config.js";
import type { ChatTurn } from "../engine/history.js";
import type { KnowledgeDocument, PromptThread } from "../engine/prompt.js";
import type { ModelTurn } from "../engine/types.js";

export type CompleteInput = {
  model: string;
  temperature: number;
  timeoutMs: number;
  /** Static system prompt, cached between turns. */
  system: string;
  /** Per-turn context appended after the cached block. */
  turnContext: string;
  messages: ChatTurn[];
  /** Structured view of the same turn. The real model ignores it; the local fake reads it. */
  scenario: {
    thread: PromptThread;
    config: CompanyConfig;
    documents: KnowledgeDocument[];
  };
};

export type LlmUsageRecord = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  latencyMs: number;
};

export type CompleteResult = {
  output: ModelTurn;
  usage: LlmUsageRecord;
};

export type LlmClient = {
  readonly kind: "anthropic" | "fake";
  complete(input: CompleteInput): Promise<CompleteResult>;
};
