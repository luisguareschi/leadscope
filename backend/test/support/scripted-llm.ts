import type { ModelTurn } from "../../src/engine/types.js";
import type { CompleteInput, LlmClient } from "../../src/llm/types.js";

export type ScriptedLlm = LlmClient & { calls: CompleteInput[]; push(...turns: Array<Partial<ModelTurn> | Error>): void };

/** An LLM that returns queued turns in order and records every request it received. */
export function scriptedLlm(...initial: Array<Partial<ModelTurn> | Error>): ScriptedLlm {
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
      const next = queue.shift() ?? { reply: "Respuesta de prueba." };
      if (next instanceof Error) throw next;
      return {
        output: {
          reply: "Respuesta de prueba.",
          intent: "continue",
          interest: null,
          budget: null,
          knowsProjects: null,
          callTime: null,
          ...next,
        },
        usage: { model: "scripted", inputTokens: 100, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, latencyMs: 1 },
      };
    },
  };
}
