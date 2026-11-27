import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { CompanyConfig } from "../companies/company-config.js";
import { MAX_REPLY_BUBBLES } from "../engine/guardrails.js";
import type { ChatTurn } from "../engine/history.js";
import { normalizeSummary } from "../engine/summary.js";
import { MAX_FILES_PER_TURN } from "../engine/turn.js";
import { INTENTS } from "../engine/types.js";
import { modelSupportsTemperature } from "./claude-models.js";
import type { CompleteInput, CompleteResult, LlmClient } from "./types.js";

const nullableText = z
  .string()
  .nullish()
  .transform((value) => value ?? null);

export const modelTurnSchema = z
  .object({
    replies: z.array(z.string()).optional(),
    reply: z.string().optional(),
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
    callNow: z
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
    summary: z
      .union([z.array(z.string()), z.string()])
      .nullish()
      .transform((value) => normalizeSummary(value)),
    sendFileIds: z
      .array(z.string())
      .nullish()
      .transform((ids) => (ids ?? []).filter((id) => id.trim().length > 0)),
  })
  .superRefine((value, ctx) => {
    if (value.replies === undefined && value.reply === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["replies"],
        message: "Expected replies array or reply string",
      });
    }
  })
  .transform(({ replies: rawReplies, reply: rawReply, ...rest }) => {
    const fromArray =
      rawReplies !== undefined
        ? rawReplies.map((item) => item.trim()).filter(Boolean)
        : [];
    const cleaned =
      fromArray.length > 0
        ? fromArray
        : rawReply?.trim()
          ? [rawReply.trim()]
          : [];
    return {
      ...rest,
      replies: cleaned,
      reply: cleaned.join("\n\n"),
    };
  });

/**
 * The submit_turn tool for one company: `collected` has one property per collect item,
 * `forbiddenTopic` lists the company's topics, and `sendFileIds` lists public sendable files
 * when the company has any. Stable until config/public files change, so it caches.
 */
export function submitTurnTool(
  config: Pick<CompanyConfig, "collect" | "forbiddenTopics">,
  sendableFileIds: string[] = [],
): Anthropic.Tool {
  const topics = config.forbiddenTopics.describe;
  const hasSendable = sendableFileIds.length > 0;
  return {
    name: "submit_turn",
    description:
      "Return the WhatsApp reply bubbles for the lead, what their messages told you, and the flags the engine acts on.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        replies: {
          type: "array",
          minItems: 1,
          maxItems: MAX_REPLY_BUBBLES,
          items: { type: "string" },
          description:
            "1 to 3 short, natural WhatsApp messages to send in order, like a real person texting (1 to 2 short sentences each). Split greeting, answer, and next question into separate items instead of one long block. Use 1 item when one short message is enough.",
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
          description:
            'When or how the lead prefers an advisor to contact them (e.g. "mañana después de las 18", "Por mensaje / WhatsApp"). null when not stated.',
        },
        intent: {
          type: "string",
          enum: [...INTENTS],
          description:
            '"not_interested" if not interested or asks to stop; "disqualified" if interested but does not fit what the company offers; "qualified" when the lead is ready for an advisor to contact them (including whenever reply confirms an advisor will call or message them); otherwise "continue".',
        },
        needsHuman: {
          type: "boolean",
          description:
            "True for a complaint, an existing purchase, or something only a person can answer.",
        },
        callNow: {
          type: "boolean",
          description:
            'True when the lead explicitly asks to talk to a person now or asks to be called or messaged by an advisor right away ("llámenme", "quiero hablar con alguien", "que me escriba un asesor").',
        },
        forbiddenTopic: {
          type: ["string", "null"],
          description:
            "The forbidden topic the lead asks about, or that your reply would touch, copied from the list. Otherwise null.",
          ...(topics.length > 0 ? { enum: [...topics, null] } : {}),
        },
        summary: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string" },
          description:
            "Two to five short bullet strings (plain text, no leading dash or newlines): the conversation so far and what the lead wants.",
        },
        ...(hasSendable
          ? {
              sendFileIds: {
                type: "array",
                maxItems: MAX_FILES_PER_TURN,
                items: { type: "string", enum: sendableFileIds },
                description:
                  "IDs from <sendable_files> to send to the lead on this turn (only public files, at most 2). Empty array [] when no file should be sent.",
              },
            }
          : {}),
      },
      required: [
        "replies",
        "collected",
        "callTime",
        "intent",
        "needsHuman",
        "callNow",
        "forbiddenTopic",
        "summary",
        ...(hasSendable ? ["sendFileIds"] : []),
      ],
    },
  };
}

function toAnthropicMessages(turns: ChatTurn[]): Anthropic.MessageParam[] {
  return turns.map((turn) => {
    if (turn.role === "user" && turn.images && turn.images.length > 0) {
      const blocks: Anthropic.ContentBlockParam[] = [
        ...turn.images.map((image): Anthropic.ImageBlockParam => ({
          type: "image",
          source: {
            type: "base64",
            media_type: image.mediaType,
            data: image.base64,
          },
        })),
        { type: "text", text: turn.content },
      ];
      return { role: "user", content: blocks };
    }
    return { role: turn.role, content: turn.content };
  });
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
    const sendableIds = (input.scenario.sendableFiles ?? []).map(
      (file) => file.id,
    );
    const tool = submitTurnTool(input.scenario.config, sendableIds);
    const response = await client.messages.create(
      {
        model: input.model,
        max_tokens: 1024,
        ...(modelSupportsTemperature(input.model)
          ? { temperature: input.temperature }
          : {}),
        system: [
          {
            type: "text",
            text: input.system,
            cache_control: { type: "ephemeral" },
          },
          { type: "text", text: input.turnContext },
        ],
        messages: toAnthropicMessages(input.messages),
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
