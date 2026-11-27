import pino from "pino";
import { describe, expect, it, vi } from "vitest";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import type { LoadedCompany } from "../../src/companies/load-company.js";
import { createIntegrations } from "../../src/integrations/registry.js";
import { createLoggedFetch } from "../../src/lib/logged-fetch.js";
import { listClaudeModels } from "../../src/llm/claude-models.js";
import { baseConfig } from "../support/harness.js";
import { testEnv } from "../support/test-env.js";

function memoryLogger() {
  const entries: Array<Record<string, unknown>> = [];
  const logger = pino(
    { level: "debug", base: undefined },
    {
      write(chunk: string) {
        entries.push(JSON.parse(chunk) as Record<string, unknown>);
      },
    },
  );
  return { logger, entries };
}

describe("createLoggedFetch", () => {
  it("logs 2xx responses at info, defaults method to GET, and strips query strings and hashes", async () => {
    const { logger, entries } = memoryLogger();
    const baseFetch = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const logged = createLoggedFetch(
      logger,
      "supabase-auth",
      baseFetch as unknown as typeof fetch,
    );

    const res = await logged(
      "https://proj.supabase.co/auth/v1/admin/users?filter=alice@example.com#frag",
    );

    expect(res.status).toBe(200);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 30,
      msg: "outbound request",
      service: "supabase-auth",
      method: "GET",
      host: "proj.supabase.co",
      path: "/auth/v1/admin/users",
      status: 200,
    });
    expect(typeof entries[0]?.ms).toBe("number");
    expect(JSON.stringify(entries[0])).not.toContain("alice@example.com");
    expect(JSON.stringify(entries[0])).not.toContain("frag");
  });

  it("logs 4xx at warn, 5xx at error, and lets init.method override Request.method", async () => {
    const { logger, entries } = memoryLogger();
    const statuses = [404, 502];
    const baseFetch = vi.fn(
      async () => new Response("{}", { status: statuses.shift() }),
    );
    const logged = createLoggedFetch(
      logger,
      "hubspot",
      baseFetch as unknown as typeof fetch,
    );

    await logged(new URL("https://api.hubapi.com/crm/v3/objects/contacts/1"), {
      method: "patch",
    });
    await logged(
      new Request("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
      }),
      { method: "put" },
    );

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      level: 40,
      msg: "outbound request",
      service: "hubspot",
      method: "PATCH",
      host: "api.hubapi.com",
      path: "/crm/v3/objects/contacts/1",
      status: 404,
    });
    expect(entries[1]).toMatchObject({
      level: 50,
      msg: "outbound request",
      service: "hubspot",
      method: "PUT",
      host: "api.hubapi.com",
      path: "/crm/v3/objects/contacts",
      status: 502,
    });
  });

  it("logs network errors at error and rethrows", async () => {
    const { logger, entries } = memoryLogger();
    const boom = new TypeError("fetch failed");
    const baseFetch = vi.fn(async () => {
      throw boom;
    });
    const logged = createLoggedFetch(
      logger,
      "kapso",
      baseFetch as unknown as typeof fetch,
    );

    await expect(
      logged("https://api.kapso.ai/meta/whatsapp/v24.0/123/messages", {
        method: "POST",
      }),
    ).rejects.toThrow(boom);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: 50,
      msg: "outbound request failed",
      service: "kapso",
      method: "POST",
      host: "api.kapso.ai",
      path: "/meta/whatsapp/v24.0/123/messages",
    });
    expect(entries[0]?.err).toMatchObject({ message: "fetch failed" });
  });

  it("sanitizes malformed URLs and Failed to parse URL errors without leaking credentials or query strings", async () => {
    const { logger, entries } = memoryLogger();
    const raw =
      "http://user:s3cr3t@host:badport/path?email=alice@example.com#frag";
    const parseErr = new TypeError(`Failed to parse URL from ${raw}`);
    const baseFetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      if (String(input).startsWith("/")) {
        return new Response("{}", { status: 200 });
      }
      throw parseErr;
    });
    const logged = createLoggedFetch(
      logger,
      "kapso",
      baseFetch as unknown as typeof fetch,
    );

    await logged("/relative/path?token=topsecret#hash");
    await expect(logged(raw)).rejects.toThrow(parseErr);

    expect(entries[0]).toMatchObject({
      level: 30,
      msg: "outbound request",
      host: "unknown",
      path: "/relative/path",
      status: 200,
    });
    expect(entries[1]).toMatchObject({
      level: 50,
      msg: "outbound request failed",
      host: "unknown",
      path: "unknown",
    });
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain("topsecret");
    expect(serialized).not.toContain("s3cr3t");
    expect(serialized).not.toContain("alice@example.com");
    expect(serialized).not.toContain("frag");
  });

  it("routes Anthropic Messages and Models API calls through logged anthropicFetch", async () => {
    const { logger, entries } = memoryLogger();
    const anthropicFetch = vi.fn(async (input: Parameters<typeof fetch>[0]) => {
      const url = String(input);
      if (url.includes("/v1/models")) {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "claude-haiku-4-5",
                display_name: "Claude Haiku 4.5",
                created_at: "2026-01-01T00:00:00Z",
                type: "model",
              },
            ],
            has_more: false,
            first_id: "claude-haiku-4-5",
            last_id: "claude-haiku-4-5",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          id: "msg_1",
          type: "message",
          role: "assistant",
          model: "claude-haiku-4-5",
          stop_reason: "tool_use",
          usage: { input_tokens: 10, output_tokens: 5 },
          content: [
            {
              type: "tool_use",
              id: "tu_1",
              name: "submit_turn",
              input: {
                replies: ["Hola"],
                collected: {
                  interest: null,
                  budget: null,
                  knowsProjects: null,
                },
                callTime: null,
                intent: "continue",
                needsHuman: false,
                callNow: false,
                forbiddenTopic: null,
                summary: ["Saludo inicial"],
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });
    const integrations = createIntegrations(testEnv(), {
      logger,
      anthropicFetch: anthropicFetch as unknown as typeof fetch,
    });
    const company: LoadedCompany = {
      id: "co-1",
      slug: "demo",
      name: "Demo",
      whatsappPhoneNumberId: null,
      config: parseCompanyConfig(baseConfig),
      instructions: "",
      secrets: { anthropicApiKey: "sk-ant-test" },
      hubspot: { enabled: false, portalId: null, uiDomain: null },
      assistantPaused: false,
    };

    const llm = integrations.llmFor(company);
    await llm.complete({
      model: "claude-haiku-4-5",
      temperature: 0.2,
      timeoutMs: 5_000,
      system: "system",
      turnContext: "context",
      messages: [{ role: "user", content: "Hola" }],
      scenario: {
        thread: {
          state: "greeting",
          collected: {},
          callTime: null,
          name: "Ana",
          source: "whatsapp",
        },
        config: company.config,
        companyName: company.name,
        documents: [],
      },
    });
    const models = await listClaudeModels(
      "sk-ant-test",
      integrations.anthropicFetch,
    );

    expect(models).toHaveLength(1);
    expect(anthropicFetch).toHaveBeenCalledTimes(2);
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: 30,
        msg: "outbound request",
        service: "anthropic",
        method: "POST",
        host: "api.anthropic.com",
        path: "/v1/messages",
        status: 200,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: 30,
        msg: "outbound request",
        service: "anthropic",
        method: "GET",
        host: "api.anthropic.com",
        path: "/v1/models",
        status: 200,
      }),
    );
  });
});
