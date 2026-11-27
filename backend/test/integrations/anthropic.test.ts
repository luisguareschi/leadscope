import { describe, expect, it, vi } from "vitest";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { createAnthropicClient } from "../../src/llm/anthropic.js";
import {
  FALLBACK_CLAUDE_MODELS,
  listClaudeModels,
} from "../../src/llm/claude-models.js";
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
    companyName: "Constructora Test",
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
        replies: ["¡Hola!", "¿Con qué presupuesto contás?"],
        collected: {
          interest: "2 dormitorios",
          budget: null,
          knowsProjects: null,
        },
        callTime: null,
        intent: "continue",
        needsHuman: false,
        forbiddenTopic: null,
        summary: ["Busca 2 dormitorios."],
      }),
    );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    const result = await client.complete(input);

    expect(result.output).toEqual({
      reply: "¡Hola!\n\n¿Con qué presupuesto contás?",
      replies: ["¡Hola!", "¿Con qué presupuesto contás?"],
      collected: {
        interest: "2 dormitorios",
        budget: null,
        knowsProjects: null,
      },
      callTime: null,
      intent: "continue",
      needsHuman: false,
      callNow: false,
      forbiddenTopic: null,
      summary: "- Busca 2 dormitorios.",
      sendFileIds: [],
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
      "replies",
      "collected",
      "callTime",
      "intent",
      "needsHuman",
      "callNow",
      "forbiddenTopic",
      "summary",
    ]);
    expect(schema.properties.replies.type).toBe("array");
    expect(schema.properties.summary.type).toBe("array");
    expect(schema.properties.callNow.type).toBe("boolean");
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
      "disqualified",
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

  it("sends Anthropic vision image blocks and exposes sendFileIds when public files exist", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      messageResponse({
        reply: "Te paso el brochure.",
        collected: { interest: null, budget: null, knowsProjects: null },
        callTime: null,
        intent: "continue",
        needsHuman: false,
        callNow: false,
        forbiddenTopic: null,
        summary: "- Pidió brochure.",
        sendFileIds: ["file-pub-1"],
      }),
    );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    const result = await client.complete({
      ...input,
      messages: [
        {
          role: "user",
          content: "Miralo",
          images: [{ mediaType: "image/jpeg", base64: "JVBERi0=" }],
        },
      ],
      scenario: {
        ...input.scenario,
        sendableFiles: [
          {
            id: "file-pub-1",
            path: "Brochure.pdf",
            format: "pdf",
            description: null,
          },
        ],
      },
    });
    expect(result.output.sendFileIds).toEqual(["file-pub-1"]);
    const body = JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body));
    expect(body.messages[0]).toEqual({
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: "JVBERi0=",
          },
        },
        { type: "text", text: "Miralo" },
      ],
    });
    expect(
      body.tools[0].input_schema.properties.sendFileIds.items.enum,
    ).toEqual(["file-pub-1"]);
  });

  it("normalizes summary arrays and double-escaped \\n strings with stray quotes", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        messageResponse({
          replies: ["Ok."],
          collected: { interest: null, budget: null, knowsProjects: null },
          callTime: null,
          intent: "continue",
          needsHuman: false,
          callNow: false,
          forbiddenTopic: null,
          summary: ["- Busca 1 dormitorio", "Presupuesto USD 150.000"],
        }),
      )
      .mockResolvedValueOnce(
        messageResponse({
          replies: ["Ok."],
          collected: { interest: null, budget: null, knowsProjects: null },
          callTime: null,
          intent: "continue",
          needsHuman: false,
          callNow: false,
          forbiddenTopic: null,
          summary:
            '- Busca 1 dormitorio\\n- Presupuesto: 50.000 pesos\\n- Listo para que un asesor lo contacte"',
        }),
      );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });
    const fromArray = await client.complete(input);
    expect(fromArray.output.summary).toBe(
      "- Busca 1 dormitorio\n- Presupuesto USD 150.000",
    );
    const fromEscaped = await client.complete(input);
    expect(fromEscaped.output.summary).toBe(
      "- Busca 1 dormitorio\n- Presupuesto: 50.000 pesos\n- Listo para que un asesor lo contacte",
    );
  });

  it("omits temperature for models released after Claude 4.6 and sends it for older models", async () => {
    const fetchImpl = vi.fn(async (..._args: Parameters<typeof fetch>) =>
      messageResponse({
        replies: ["Hola."],
        collected: { interest: null, budget: null, knowsProjects: null },
        callTime: null,
        intent: "continue",
        needsHuman: false,
        callNow: false,
        forbiddenTopic: null,
        summary: ["Saludo inicial."],
      }),
    );
    const client = createAnthropicClient("sk-test", {
      fetch: fetchImpl as unknown as typeof fetch,
      maxRetries: 0,
    });

    for (const model of [
      "claude-haiku-5-5",
      "claude-haiku-5-5-20261101",
      "claude-sonnet-5-5",
      "claude-opus-4-7",
      "claude-opus-4-8",
      "claude-fable-5-1",
    ]) {
      await client.complete({ ...input, model, temperature: 0.4 });
      const body = JSON.parse(String(fetchImpl.mock.calls.at(-1)![1]?.body));
      expect(body).not.toHaveProperty("temperature");
    }

    for (const model of [
      "claude-haiku-4-5",
      "claude-haiku-4-5-20251001",
      "claude-sonnet-4-6",
      "claude-opus-4-6",
      "claude-3-5-haiku-20241022",
    ]) {
      await client.complete({ ...input, model, temperature: 0.4 });
      const body = JSON.parse(String(fetchImpl.mock.calls.at(-1)![1]?.body));
      expect(body.temperature).toBe(0.4);
    }
  });

  it("exposes supportsTemperature on fallback and listed Claude models", async () => {
    const byId = new Map(
      FALLBACK_CLAUDE_MODELS.map((m) => [m.value, m.supportsTemperature]),
    );
    expect(byId.get("claude-haiku-5-5")).toBe(false);
    expect(byId.get("claude-sonnet-5-5")).toBe(false);
    expect(byId.get("claude-opus-5-5")).toBe(false);
    expect(byId.get("claude-fable-5-1")).toBe(false);
    expect(byId.get("claude-opus-4-8")).toBe(false);
    expect(byId.get("claude-haiku-4-5")).toBe(true);
    expect(byId.get("claude-sonnet-4-6")).toBe(true);

    const fetchImpl = vi.fn(async () =>
      Response.json({
        data: [
          {
            id: "claude-haiku-5-5",
            display_name: "Claude Haiku 5.5",
            created_at: "2026-11-01T00:00:00Z",
            type: "model",
          },
          {
            id: "claude-haiku-4-5-20251001",
            display_name: "Claude Haiku 4.5",
            created_at: "2025-10-01T00:00:00Z",
            type: "model",
          },
        ],
        has_more: false,
        first_id: "claude-haiku-5-5",
        last_id: "claude-haiku-4-5-20251001",
      }),
    );
    const listed = await listClaudeModels(
      "sk-test",
      fetchImpl as unknown as typeof fetch,
    );
    expect(listed).toEqual([
      {
        value: "claude-haiku-5-5",
        label: "Claude Haiku 5.5",
        legacy: false,
        supportsTemperature: false,
      },
      {
        value: "claude-haiku-4-5-20251001",
        label: "Claude Haiku 4.5",
        legacy: true,
        supportsTemperature: true,
      },
    ]);
  });
});
