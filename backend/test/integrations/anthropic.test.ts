import { describe, expect, it, vi } from "vitest";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { createAnthropicClient } from "../../src/llm/anthropic.js";
import type { CompleteInput } from "../../src/llm/types.js";
import { baseConfig } from "../support/harness.js";

const input: CompleteInput = {
  model: "claude-haiku-4-5",
  temperature: 0.4,
  timeoutMs: 10_000,
  system: "SYSTEM PROMPT",
  turnContext: "TURN CONTEXT",
  messages: [{ role: "user", content: "Hola, busco 2 dormitorios" }],
  scenario: {
    thread: {
      state: "greeting",
      collected: {},
      summary: null,
      callTime: null,
      name: null,
      source: "whatsapp",
    },
    config: parseCompanyConfig(baseConfig),
    documents: [],
  },
};

function messageResponse(toolInput: unknown) {
  return Response.json({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    stop_reason: "tool_use",
    stop_sequence: null,
    content: [
      {
        type: "tool_use",
        id: "toolu_1",
        name: "submit_turn",
        input: toolInput,
      },
    ],
    usage: {
      input_tokens: 1200,
      output_tokens: 80,
      cache_read_input_tokens: 1000,
      cache_creation_input_tokens: 0,
    },
  });
}

describe("Anthropic client", () => {
  it("caches the static prompt, forces submit_turn, and parses the turn", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      messageResponse({
        reply: "¡Hola! ¿Con qué presupuesto contás?",
        collected: {
          interest: "2 dormitorios",
          budget: null,
          knowsProjects: null,
        },
        callTime: null,
        intent: "continue",
        needsHuman: false,
        forbiddenTopic: null,
        summary: "- Busca 2 dormitorios.",
      }),
    );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    const result = await client.complete(input);

    expect(result.output).toEqual({
      reply: "¡Hola! ¿Con qué presupuesto contás?",
      collected: {
        interest: "2 dormitorios",
        budget: null,
        knowsProjects: null,
      },
      callTime: null,
      intent: "continue",
      needsHuman: false,
      forbiddenTopic: null,
      summary: "- Busca 2 dormitorios.",
    });
    expect(result.usage).toMatchObject({
      inputTokens: 1200,
      outputTokens: 80,
      cacheReadTokens: 1000,
      cacheWriteTokens: 0,
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://api.anthropic.com/v1/messages");
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("claude-haiku-4-5");
    expect(body.system).toEqual([
      {
        type: "text",
        text: "SYSTEM PROMPT",
        cache_control: { type: "ephemeral" },
      },
      { type: "text", text: "TURN CONTEXT" },
    ]);
    expect(body.tool_choice).toEqual({
      type: "tool",
      name: "submit_turn",
      disable_parallel_tool_use: true,
    });
    const schema = body.tools[0].input_schema;
    expect(schema.required).toEqual([
      "reply",
      "collected",
      "callTime",
      "intent",
      "needsHuman",
      "forbiddenTopic",
      "summary",
    ]);
    expect(schema.properties.collected.required).toEqual([
      "interest",
      "budget",
      "knowsProjects",
    ]);
    expect(schema.properties.collected.properties.budget.description).toBe(
      "Presupuesto: Con qué presupuesto cuenta.",
    );
    expect(schema.properties.intent.enum).toEqual([
      "continue",
      "qualified",
      "not_interested",
    ]);
    expect(schema.properties.forbiddenTopic.enum).toEqual([
      "Rentabilidad futura",
      "Alquiler o renta garantizada, o cualquier promesa de ingresos.",
      null,
    ]);
    expect(body.scenario).toBeUndefined();
  });

  it("builds collected from the company's own items, and treats any forbidden-topic value as flagged", async () => {
    const config = parseCompanyConfig({
      ...baseConfig,
      collect: [
        {
          key: "zona",
          name: "Zona",
          description: "Barrio preferido.",
          required: false,
        },
      ],
      forbiddenTopics: { describe: [] },
    });
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      messageResponse({
        reply: "Te paso con un asesor.",
        collected: { zona: "Pocitos", ajena: "x" },
        callTime: null,
        intent: "continue",
        needsHuman: false,
        forbiddenTopic: true,
        summary: "- Quiere Pocitos.",
      }),
    );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    const result = await client.complete({
      ...input,
      scenario: { ...input.scenario, config },
    });
    expect(result.output.forbiddenTopic).toBe("(sin especificar)");
    expect(result.output.collected.zona).toBe("Pocitos");
    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    const schema = body.tools[0].input_schema;
    expect(Object.keys(schema.properties.collected.properties)).toEqual([
      "zona",
    ]);
    expect(schema.properties.forbiddenTopic.enum).toBeUndefined();
  });

  it("asks again once when the tool input is invalid, then gives up", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(messageResponse({ reply: "x", intent: "maybe" }))
      .mockResolvedValueOnce(
        messageResponse({ reply: "Ok", intent: "continue" }),
      );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    await expect(client.complete(input)).resolves.toMatchObject({
      output: {
        reply: "Ok",
        collected: {},
        needsHuman: false,
        forbiddenTopic: null,
      },
    });

    const alwaysBad = vi.fn(async () => messageResponse({ nope: true }));
    const failing = createAnthropicClient("sk-test", {
      fetch: alwaysBad as unknown as typeof fetch,
      maxRetries: 0,
    });
    await expect(failing.complete(input)).rejects.toThrow(
      "invalid submit_turn input",
    );
    expect(alwaysBad).toHaveBeenCalledTimes(2);
  });

  it("surfaces API errors so the engine can fall back", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        {
          type: "error",
          error: { type: "overloaded_error", message: "Overloaded" },
        },
        { status: 529 },
      ),
    );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    await expect(client.complete(input)).rejects.toThrow(/Overloaded/);
  });
});
