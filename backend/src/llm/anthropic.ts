import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CompanyConfig } from "../companies/company-config.js";
import { INTENTS } from "../engine/types.js";
import type { CompleteInput, CompleteResult, LlmClient } from "./types.js";

const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const modelTurnSchema = z.object({
  reply: z.string(),
  collected: z
    .record(z.string(), z.unknown())
    .nullish()
    .transform((values) =>
      Object.fromEntries(
        Object.entries(values ?? {}).map(([key, value]) => [
          key,
          typeof value === "string"
            ? value
            : typeof value === "number"
              ? String(value)
              : null,
        ]),
      ),
    ),
  callTime: nullableText,
  intent: z.enum(INTENTS),
  needsHuman: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  // Fails safe: anything set (even `true` instead of the topic) counts as flagged.
  forbiddenTopic: z
    .union([z.string(), z.boolean()])
    .nullish()
    .transform((value) =>
      value === true
        ? "(sin especificar)"
        : typeof value === "string"
          ? value.trim() || null
          : null,
    ),
  summary: nullableText,
});

/**
 * The submit_turn tool for one company: `collected` has one property per collect item, and
 * `forbiddenTopic` lists the company's topics. Stable until the config changes, so it caches.
 */
export function submitTurnTool(
  config: Pick<CompanyConfig, "collect" | "forbiddenTopics">,
): Anthropic.Tool {
  const topics = config.forbiddenTopics.describe;
  return {
    name: "submit_turn",
    description:
      "Return the WhatsApp reply for the lead, what their messages told you, and the flags the engine acts on.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        reply: {
          type: "string",
          description: "The WhatsApp message to send to the lead.",
        },
        collected: {
          type: "object",
          additionalProperties: false,
          description:
            "What the lead's own messages state about each item, in a few words. null when this turn does not add or change it.",
          properties: Object.fromEntries(
            config.collect.map((item) => [
              item.key,
              {
                type: ["string", "null"],
                description: `${item.name}: ${item.description}`,
              },
            ]),
          ),
          required: config.collect.map((item) => item.key),
        },
        callTime: {
          type: ["string", "null"],
          description: "When the lead says an advisor can call them.",
        },
        intent: { type: "string", enum: [...INTENTS] },
        needsHuman: {
          type: "boolean",
          description:
            "True for a complaint, an existing purchase, or a lead who insists on a person.",
        },
        forbiddenTopic: {
          type: ["string", "null"],
          description:
            "The forbidden topic the lead asks about, or that your reply would touch, copied from the list. Otherwise null.",
          ...(topics.length > 0 ? { enum: [...topics, null] } : {}),
        },
        summary: {
          type: "string",
          description:
            'Two to five short bullets, each starting with "- ": the conversation so far and what the lead wants.',
        },
      },
      required: [
        "reply",
        "collected",
        "callTime",
        "intent",
        "needsHuman",
        "forbiddenTopic",
        "summary",
      ],
    },
  };
}

const MAX_ATTEMPTS_ON_INVALID_OUTPUT = 2;

export class InvalidModelOutputError extends Error {}

export function createAnthropicClient(
  apiKey: string,
  options: { fetch?: typeof fetch; maxRetries?: number } = {},
): LlmClient {
  const client = new Anthropic({
    apiKey,
    maxRetries: options.maxRetries ?? 2,
    fetch: options.fetch,
  });

  async function callOnce(input: CompleteInput): Promise<CompleteResult> {
    const started = Date.now();
    const tool = submitTurnTool(input.scenario.config);
    const response = await client.messages.create(
      {
        model: input.model,
        max_tokens: 1024,
        temperature: input.temperature,
        system: [
          {
            type: "text",
            text: input.system,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: input.turnContext },
        ],
        messages: input.messages,
        tools: [tool],
        tool_choice: {
          type: "tool",
          name: tool.name,
          disable_parallel_tool_use: true,
        },
      },
      { timeout: input.timeoutMs },
    );
    const toolUse = response.content.find((block) => block.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      throw new InvalidModelOutputError(
        `model returned no tool call (stop_reason: ${response.stop_reason})`,
      );
    }
    const parsed = modelTurnSchema.safeParse(toolUse.input);
    if (!parsed.success)
      throw new InvalidModelOutputError(
        `invalid submit_turn input: ${parsed.error.message}`,
      );
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
      for (
        let attempt = 1;
        attempt <= MAX_ATTEMPTS_ON_INVALID_OUTPUT;
        attempt += 1
      ) {
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
