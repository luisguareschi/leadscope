import { describe, expect, it } from "vitest";
import {
  WHATSAPP_SERVICE_USD,
  WHATSAPP_TEMPLATE_USD,
  anthropicSpend,
  anthropicUsd,
  mergeAnthropicSpend,
  whatsappSpend,
} from "../../src/features/metrics/pricing.js";

const million = {
  inputTokens: 1_000_000,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
};

describe("anthropic pricing", () => {
  it("prices a dated snapshot id like its alias", () => {
    expect(anthropicUsd("claude-haiku-4-5-20251001", million)).toBe(1);
    expect(anthropicUsd("claude-haiku-4-5", million)).toBe(1);
  });

  it("leaves unknown models unpriced", () => {
    const spend = anthropicSpend([
      { model: "claude-unknown-9", calls: 1, ...million },
    ]);
    expect(spend.usd).toBeNull();
    expect(spend.unpricedModels).toEqual(["claude-unknown-9"]);
  });

  it("merges real and test usage while preserving each bucket", () => {
    const merged = mergeAnthropicSpend(
      [
        { model: "claude-haiku-4-5", calls: 2, ...million },
        { model: "claude-mystery", calls: 1, ...million },
      ],
      [{ model: "claude-haiku-4-5", calls: 3, ...million }],
    );
    expect(merged.realUsd).toBe(1);
    expect(merged.testUsd).toBe(1);
    expect(merged.usd).toBe(2);
    expect(merged.realCalls).toBe(3);
    expect(merged.testCalls).toBe(3);
    expect(merged.calls).toBe(6);
    expect(merged.unpricedModels).toEqual(["claude-mystery"]);
    expect(merged.byModel).toEqual([
      {
        model: "claude-haiku-4-5",
        calls: 5,
        inputTokens: 2_000_000,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        usd: 2,
      },
      {
        model: "claude-mystery",
        calls: 1,
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        usd: null,
      },
    ]);
  });
});

describe("whatsapp pricing", () => {
  it("accounts for prior service messages in a partial first month", () => {
    const nov20 = new Date("2026-11-20T15:00:00.000Z");
    const dec02 = new Date("2026-12-02T15:00:00.000Z");
    const result = whatsappSpend(
      2,
      [nov20, nov20, nov20, dec02],
      "America/Montevideo",
      { firstMonth: "2026-11", priorServiceInFirstMonth: 999 },
    );
    expect(result).toEqual({
      usd: 2 * WHATSAPP_TEMPLATE_USD + 2 * WHATSAPP_SERVICE_USD,
      templates: 2,
      serviceMessages: 4,
      freeServiceMessages: 2,
      billableServiceMessages: 2,
    });
  });
});
