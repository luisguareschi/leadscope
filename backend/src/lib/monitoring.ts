import * as Sentry from "@sentry/node";
import { REDACTED_KEYS } from "./redacted-keys.js";

export const DEFAULT_TRACES_SAMPLE_RATE = 1;

const REDACTED_KEY_SET = new Set(REDACTED_KEYS.map((key) => key.toLowerCase()));

let enabled = false;

export type MonitoringOptions = {
  dsn: string | undefined;
  environment?: string;
  tracesSampleRate?: number;
  release?: string;
};

export function parseTracesSampleRate(raw: string | undefined): number {
  if (!raw || raw.trim() === "") return DEFAULT_TRACES_SAMPLE_RATE;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return DEFAULT_TRACES_SAMPLE_RATE;
  }
  return parsed;
}

function isHealthPath(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const path = value.split("?")[0];
  return path === "/health" || path === "/health/";
}

type SamplingContextLike = {
  name?: string;
  attributes?: Record<string, unknown>;
};

export function shouldSampleTrace(
  samplingContext: SamplingContextLike,
  sampleRate: number,
): number {
  const attrs = samplingContext.attributes ?? {};
  const method =
    attrs["http.request.method"] ?? attrs["http.method"] ?? undefined;
  if (typeof method === "string" && method.toUpperCase() === "OPTIONS") {
    return 0;
  }
  const route = attrs["http.route"] ?? attrs["url.path"];
  if (isHealthPath(route)) return 0;

  const name = samplingContext.name ?? "";
  if (
    /^OPTIONS\b/i.test(name) ||
    /^(?:GET|HEAD)\s+\/health\/?(?:\?|$)/i.test(name) ||
    isHealthPath(name)
  ) {
    return 0;
  }
  return sampleRate;
}

function isSensitiveAttributeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (REDACTED_KEY_SET.has(normalized)) return true;
  const lastSegment = normalized.split(".").at(-1);
  return lastSegment !== undefined && REDACTED_KEY_SET.has(lastSegment);
}

export function scrubLogForSentry(log: Sentry.Log): Sentry.Log | null {
  const attributes = log.attributes;
  if (attributes && isHealthPath(attributes.path)) {
    return null;
  }
  if (!attributes) return log;

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    scrubbed[key] = isSensitiveAttributeKey(key) ? "[redacted]" : value;
  }
  return { ...log, attributes: scrubbed };
}

export function initMonitoring(options: MonitoringOptions): boolean {
  if (enabled || !options.dsn) return enabled;
  const sampleRate = options.tracesSampleRate ?? DEFAULT_TRACES_SAMPLE_RATE;

  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    tracesSampler: (ctx) => shouldSampleTrace(ctx, sampleRate),
    // Conversations are personal data (Ley 18.331): never ship request bodies,
    // headers, cookies, query params, DB bindings, or LLM prompts/outputs to Sentry.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    integrations: [
      Sentry.pinoIntegration({
        log: { levels: ["debug", "info", "warn", "error", "fatal"] },
        error: { levels: [] },
      }),
    ],
    beforeSendLog: scrubLogForSentry,
  });

  enabled = true;
  return true;
}

export function initMonitoringFromEnv(
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  const dsn = source.SENTRY_DSN?.trim() || undefined;
  const release =
    source.SENTRY_RELEASE?.trim() ||
    source.RENDER_GIT_COMMIT?.trim() ||
    undefined;
  return initMonitoring({
    dsn,
    environment: source.NODE_ENV || "development",
    tracesSampleRate: parseTracesSampleRate(source.SENTRY_TRACES_SAMPLE_RATE),
    release,
  });
}

export function isMonitoringEnabled(): boolean {
  return enabled;
}

export function reportError(
  error: unknown,
  context?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!enabled) return;
  if (!context) {
    Sentry.captureException(error);
    return;
  }
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context)) {
      if (value === null || value === undefined) continue;
      if (isSensitiveAttributeKey(key)) continue;
      scope.setTag(key, String(value));
    }
    Sentry.captureException(error);
  });
}

export function withBackgroundTrace<T>(
  name: string,
  op: string,
  attributes: Record<string, string | number | boolean>,
  fn: () => Promise<T>,
): Promise<T> {
  if (!enabled) return fn();
  return Sentry.startNewTrace(() =>
    Sentry.startSpan({ name, op, attributes }, () => fn()),
  );
}

export async function flushMonitoring(timeoutMs = 2000): Promise<boolean> {
  if (!enabled) return true;
  return Sentry.flush(timeoutMs);
}
