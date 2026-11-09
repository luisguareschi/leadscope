import { describe, expect, it } from "vitest";
import {
  anthropicSpend,
  anthropicUsd,
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
});
