import Anthropic from "@anthropic-ai/sdk";

export type ModelOption = {
  value: string;
  label: string;
  legacy: boolean;
  supportsTemperature: boolean;
};

const LEGACY_TEMPERATURE_MODELS = new Set([
  "claude-haiku-4-5",
  "claude-sonnet-4",
  "claude-sonnet-4-0",
  "claude-sonnet-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4",
  "claude-opus-4-0",
  "claude-opus-4-1",
  "claude-opus-4-5",
  "claude-opus-4-6",
]);

/**
 * Anthropic deprecated `temperature` on models released after Claude 4.6 (Opus 4.7+, 5+, 5.5+);
 * sending non-default values returns HTTP 400. Allowlisting older generations keeps future models
 * safe by default.
 */
export function modelSupportsTemperature(model: string): boolean {
  const base = model
    .trim()
    .toLowerCase()
    .replace(/-\d{8}$/, "");
  return base.startsWith("claude-3-") || LEGACY_TEMPERATURE_MODELS.has(base);
}

const FALLBACK_MODEL_SPECS: Array<Omit<ModelOption, "supportsTemperature">> = [
  { value: "claude-haiku-5-5", label: "Claude Haiku 5.5", legacy: false },
  { value: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", legacy: false },
  { value: "claude-opus-5-5", label: "Claude Opus 5.5", legacy: false },
  { value: "claude-fable-5-1", label: "Claude Fable 5.1", legacy: false },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5", legacy: true },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5", legacy: true },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", legacy: true },
  { value: "claude-opus-5", label: "Claude Opus 5", legacy: true },
  { value: "claude-opus-4-8", label: "Claude Opus 4.8", legacy: true },
  { value: "claude-fable-5", label: "Claude Fable 5", legacy: true },
];

/**
 * Shown when the company has no Anthropic key or the Models API does not answer. Current lineup
 * first, then the older models still served. `claude-haiku-4-5` is the v1 default.
 */
export const FALLBACK_CLAUDE_MODELS: ModelOption[] = FALLBACK_MODEL_SPECS.map(
  (model) => ({
    ...model,
    supportsTemperature: modelSupportsTemperature(model.value),
  }),
);

const CURRENT = new Set(
  FALLBACK_CLAUDE_MODELS.filter((model) => !model.legacy).map((m) => m.value),
);

/** The models this key can call, newest first, from Anthropic's Models API. */
export async function listClaudeModels(
  apiKey: string,
  fetchImpl?: typeof fetch,
): Promise<ModelOption[]> {
  const client = new Anthropic({
    apiKey,
    fetch: fetchImpl,
    maxRetries: 0,
    timeout: 5_000,
  });
  const models: ModelOption[] = [];
  for await (const model of client.models.list({ limit: 100 })) {
    models.push({
      value: model.id,
      label: model.display_name || model.id,
      legacy: !CURRENT.has(model.id),
      supportsTemperature: modelSupportsTemperature(model.id),
    });
    if (models.length >= 200) break;
  }
  return models;
}
