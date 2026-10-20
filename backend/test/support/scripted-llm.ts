import type { ModelTurn } from "../../src/engine/types.js";
import type { CompleteInput, LlmClient } from "../../src/llm/types.js";

/** A queued turn, an error to throw, or a step that runs while the model is "thinking". */
type ScriptedTurn =
  Partial<ModelTurn> | Error | (() => Promise<Partial<ModelTurn>>);

export type ScriptedLlm = LlmClient & {
  calls: CompleteInput[];
  push(...turns: ScriptedTurn[]): void;
};

/** An LLM that returns queued turns in order and records every request it received. */
export function scriptedLlm(...initial: ScriptedTurn[]): ScriptedLlm {
  const queue = [...initial];
  const calls: CompleteInput[] = [];
  return {
    kind: "fake",
    calls,
    push(...turns) {
      queue.push(...turns);
    },
    async complete(input) {
      calls.push(input);
      const queued = queue.shift() ?? { reply: "Respuesta de prueba." };
      if (queued instanceof Error) throw queued;
      const next = typeof queued === "function" ? await queued() : queued;
      return {
        output: {
          reply: "Respuesta de prueba.",
          intent: "continue",
          collected: {},
          callTime: null,
          needsHuman: false,
          forbiddenTopic: null,
          summary: null,
          ...next,
        },
        usage: {
          model: "scripted",
          inputTokens: 100,
          outputTokens: 20,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          latencyMs: 1,
        },
      };
    },
  };
}
