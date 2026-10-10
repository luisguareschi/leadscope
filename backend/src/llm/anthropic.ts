import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { INTENTS } from "../engine/types.js";
import type { CompleteInput, CompleteResult, LlmClient } from "./types.js";

const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const modelTurnSchema = z.object({
  reply: z.string(),
  interest: nullableText,
  budget: nullableText,
  knowsProjects: z
    .boolean()
    .nullish()
    .transform((value) => value ?? null),
  callTime: nullableText,
  intent: z.enum(INTENTS),
});

export const SUBMIT_TURN_TOOL: Anthropic.Tool = {
  name: "submit_turn",
  description: "Return the WhatsApp reply for the lead and any lead details stated in their messages.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      reply: { type: "string", description: "The WhatsApp message to send to the lead." },
      interest: { type: ["string", "null"], description: "What the lead is looking for, in their words." },
      budget: { type: ["string", "null"], description: "The lead's budget, in their words." },
      knowsProjects: {
        type: ["boolean", "null"],
        description: "Whether the lead says they already know the company's projects.",
      },
      callTime: { type: ["string", "null"], description: "When the lead says an advisor can call them." },
      intent: { type: "string", enum: [...INTENTS] },
    },
    required: ["reply", "interest", "budget", "knowsProjects", "callTime", "intent"],
  },
};

const MAX_ATTEMPTS_ON_INVALID_OUTPUT = 2;

export class InvalidModelOutputError extends Error {}

export function createAnthropicClient(apiKey: string): LlmClient {
  const client = new Anthropic({ apiKey, maxRetries: 2 });

  async function callOnce(input: CompleteInput): Promise<CompleteResult> {
    const started = Date.now();
    const response = await client.messages.create(
      {
        model: input.model,
        max_tokens: 1024,
        temperature: input.temperature,
        system: [
          { type: "text", text: input.system, cache_control: { type: "ephemeral" } },
          { type: "text", text: input.turnContext },
        ],
        messages: input.messages,
        tools: [SUBMIT_TURN_TOOL],
        tool_choice: { type: "tool", name: SUBMIT_TURN_TOOL.name, disable_parallel_tool_use: true },
      },
      { timeout: input.timeoutMs },
    );
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new InvalidModelOutputError(`model returned no tool call (stop_reason: ${response.stop_reason})`);
    }
    const parsed = modelTurnSchema.safeParse(toolUse.input);
    if (!parsed.success) throw new InvalidModelOutputError(`invalid submit_turn input: ${parsed.error.message}`);
    return {
      output: parsed.data,
      usage: {
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
        latencyMs: Date.now() - started,
      },
    };
  }

  return {
    kind: "anthropic",
    async complete(input) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_ON_INVALID_OUTPUT; attempt += 1) {
        try {
          return await callOnce(input);
        } catch (error) {
          if (!(error instanceof InvalidModelOutputError)) throw error;
          lastError = error;
        }
      }
      throw lastError;
    },
  };
}
