import { localParts } from "./time-zone.js";

/**
 * Anthropic list prices, checked 9 Nov 2026. Update when Anthropic changes prices.
 * USD per million tokens. `input` is the uncached input price: `LlmUsage.inputTokens`
 * stores Anthropic's `input_tokens`, which does not include cache read or cache write.
 */
export const ANTHROPIC_TOKEN_PRICES_USD_PER_MILLION = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheRead: 0.01,
    cacheWrite: 0.125,
  },
  "claude-sonnet-4-6": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  "claude-sonnet-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-sonnet-5-5": {
    input: 2,
    output: 10,
    cacheRead: 0.2,
    cacheWrite: 2.5,
  },
  "claude-opus-4-8": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-fable-5": { input: 10, output: 50, cacheRead: 1, cacheWrite: 12.5 },
  "claude-fable-5-1": {
    input: 10,
    output: 50,
    cacheRead: 0.25,
    cacheWrite: 12.5,
  },
} as const;

type TokenPrice =
  (typeof ANTHROPIC_TOKEN_PRICES_USD_PER_MILLION)[keyof typeof ANTHROPIC_TOKEN_PRICES_USD_PER_MILLION];

export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

function priceFor(model: string): TokenPrice | null {
  if (!(model in ANTHROPIC_TOKEN_PRICES_USD_PER_MILLION)) return null;
  return ANTHROPIC_TOKEN_PRICES_USD_PER_MILLION[
    model as keyof typeof ANTHROPIC_TOKEN_PRICES_USD_PER_MILLION
  ];
}

export function anthropicUsd(
  model: string,
  tokens: TokenCounts,
): number | null {
  const price = priceFor(model);
  if (!price) return null;
  return (
    (tokens.inputTokens * price.input +
      tokens.outputTokens * price.output +
      tokens.cacheReadTokens * price.cacheRead +
      tokens.cacheWriteTokens * price.cacheWrite) /
    1_000_000
  );
}

export type ModelUsage = TokenCounts & { model: string; calls: number };

export type AnthropicSpend = {
  usd: number | null;
  calls: number;
  byModel: (ModelUsage & { usd: number | null })[];
  unpricedModels: string[];
};

export function anthropicSpend(rows: ModelUsage[]): AnthropicSpend {
  const byModel = rows
    .map((row) => ({ ...row, usd: anthropicUsd(row.model, row) }))
    .sort((a, b) => a.model.localeCompare(b.model));
  const calls = byModel.reduce((sum, row) => sum + row.calls, 0);
  if (byModel.length === 0) {
    return { usd: 0, calls: 0, byModel: [], unpricedModels: [] };
  }
  const unpricedModels = byModel
    .filter((row) => row.usd === null)
    .map((row) => row.model);
  const priced = byModel.flatMap((row) => (row.usd === null ? [] : [row.usd]));
  return {
    usd: priced.length === 0 ? null : priced.reduce((sum, usd) => sum + usd, 0),
    calls,
    byModel,
    unpricedModels,
  };
}

/** Meta, Uruguay (Rest of Latin America), from 1 Oct 2026. Estimate only. */
export const WHATSAPP_TEMPLATE_USD = 0.085;
export const WHATSAPP_SERVICE_USD = 0.0113;
export const WHATSAPP_FREE_SERVICE_PER_MONTH = 1000;

export type WhatsappSpend = {
  usd: number;
  templates: number;
  serviceMessages: number;
  freeServiceMessages: number;
};

/**
 * `templates` is non-failed template sends (every template is priced as marketing).
 * `serviceSentAt` is non-failed free-form outbound. The 1,000 free service
 * messages apply once per calendar month in `timeZone`.
 */
export function whatsappSpend(
  templates: number,
  serviceSentAt: Date[],
  timeZone: string,
): WhatsappSpend {
  const byMonth = new Map<string, number>();
  for (const sentAt of serviceSentAt) {
    const month = localParts(sentAt, timeZone).dateStr.slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }
  let freeServiceMessages = 0;
  let billable = 0;
  for (const count of byMonth.values()) {
    const free = Math.min(WHATSAPP_FREE_SERVICE_PER_MONTH, count);
    freeServiceMessages += free;
    billable += count - free;
  }
  return {
    usd: templates * WHATSAPP_TEMPLATE_USD + billable * WHATSAPP_SERVICE_USD,
    templates,
    serviceMessages: serviceSentAt.length,
    freeServiceMessages,
  };
}

/** Two decimal places. Line items stay unrounded; only the combined total uses this. */
export function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}
