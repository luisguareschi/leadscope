import * as Sentry from "@sentry/node";
import { REDACTED_KEYS } from "./redacted-keys.js";

export const DEFAULT_TRACES_SAMPLE_RATE = 1;

const REDACTED_KEY_SET = new Set(REDACTED_KEYS.map((key) => key.toLowerCase()));
const STRIPPED_OBJECT_KEYS = new Set([
  "headers",
  "request",
  "response",
  "config",
]);
const SAFE_TELEMETRY_PREFIXES = [
  "sentry.",
  "pino.",
  "os.",
  "process.",
  "service.",
  "server.",
  "runtime.",
];
const SAFE_EVENT_CONTEXTS = new Set(["os", "runtime", "device", "trace"]);

const BEARER_OR_BASIC_RE = /\b(Bearer|Basic)\s+[A-Za-z0-9\-._~+/]+=*/gi;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const E164_PHONE_RE = /(?<!\w)\+\d{7,15}\b/g;
const FORMATTED_INTL_PHONE_RE =
  /(?<!\w)\+\d{1,3}[\s.-]\d{2,4}[\s.-]\d{3,4}(?:[\s.-]\d{2,4})?\b/g;

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
  const origin = attrs["sentry.origin"];
  const name = samplingContext.name ?? "";

  // Drop orphan root Prisma traces (e.g. idle 30s sweeper polls). Prisma spans
  // inside HTTP requests, conversation turns, and CRM syncs stay sampled as children.
  if (origin === "auto.db.prisma" || name.startsWith("prisma:")) {
    return 0;
  }

  const method =
    attrs["http.request.method"] ?? attrs["http.method"] ?? undefined;
  if (typeof method === "string" && method.toUpperCase() === "OPTIONS") {
    return 0;
  }
  const route = attrs["http.route"] ?? attrs["url.path"];
  if (isHealthPath(route)) return 0;

  if (
    /^OPTIONS\b/i.test(name) ||
    /^(?:GET|HEAD)\s+\/health\/?(?:\?|$)/i.test(name) ||
    isHealthPath(name)
  ) {
    return 0;
  }
  return sampleRate;
}

export function isSensitiveAttributeKey(key: string): boolean {
  const normalized = key.toLowerCase();
  if (SAFE_TELEMETRY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false;
  }
  if (REDACTED_KEY_SET.has(normalized)) return true;
  const lastSegment = normalized.split(".").at(-1);
  return lastSegment !== undefined && REDACTED_KEY_SET.has(lastSegment);
}

export function scrubText(value: string): string {
  return value
    .replace(BEARER_OR_BASIC_RE, "$1 [redacted]")
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(FORMATTED_INTL_PHONE_RE, "[redacted-phone]")
    .replace(E164_PHONE_RE, "[redacted-phone]");
}

function scrubValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (typeof value === "string") return scrubText(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= 6 || seen.has(value)) return "[redacted]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (STRIPPED_OBJECT_KEYS.has(lower) || isSensitiveAttributeKey(key)) {
      out[key] = "[redacted]";
    } else {
      out[key] = scrubValue(entry, depth + 1, seen);
    }
  }
  return out;
}

export function scrubLogForSentry(log: Sentry.Log): Sentry.Log | null {
  const attributes = log.attributes;
  if (attributes && isHealthPath(attributes.path)) {
    return null;
  }

  const message =
    typeof log.message === "string" ? scrubText(log.message) : log.message;
  if (!attributes) return { ...log, message };

  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (isSensitiveAttributeKey(key)) {
      scrubbed[key] = "[redacted]";
    } else if (
      SAFE_TELEMETRY_PREFIXES.some((prefix) =>
        key.toLowerCase().startsWith(prefix),
      )
    ) {
      scrubbed[key] = value;
    } else {
      scrubbed[key] = scrubValue(value);
    }
  }
  return { ...log, message, attributes: scrubbed };
}

export function scrubEventForSentry(
  event: Sentry.ErrorEvent,
): Sentry.ErrorEvent {
  if (typeof event.message === "string") {
    event.message = scrubText(event.message);
  }
  if (event.logentry) {
    if (typeof event.logentry.message === "string") {
      event.logentry.message = scrubText(event.logentry.message);
    }
    if (Array.isArray(event.logentry.params)) {
      event.logentry.params = scrubValue(event.logentry.params) as unknown[];
    }
  }
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (typeof exception.value === "string") {
        exception.value = scrubText(exception.value);
      }
    }
  }
  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (typeof crumb.message === "string") {
        crumb.message = scrubText(crumb.message);
      }
      if (crumb.data) {
        crumb.data = scrubValue(crumb.data) as Record<string, unknown>;
      }
    }
  }
  if (event.extra) {
    event.extra = scrubValue(event.extra) as Record<string, unknown>;
  }
  if (event.contexts) {
    for (const [name, ctx] of Object.entries(event.contexts)) {
      if (SAFE_EVENT_CONTEXTS.has(name) || !ctx) continue;
      event.contexts[name] = scrubValue(ctx) as Record<string, unknown>;
    }
  }
  return event;
}

export function initMonitoring(options: MonitoringOptions): boolean {
  const dsn = options.dsn?.trim();
  if (enabled || !dsn) return enabled;
  const sampleRate = options.tracesSampleRate ?? DEFAULT_TRACES_SAMPLE_RATE;

  Sentry.init({
    dsn,
    environment: options.environment,
    release: options.release,
    tracesSampler: (ctx) => shouldSampleTrace(ctx, sampleRate),
    // Never inject sentry-trace / baggage headers into third-party APIs
    // (Anthropic, HubSpot, Kapso, Supabase, external media CDNs).
    tracePropagationTargets: [],
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
      // Keep Express route/middleware tracing while letting error-handler.ts stay
      // the single source of truth for HTTP error reporting (avoids reporting expected
      // 400/413 MulterError responses as unhandled 500s).
      Sentry.expressIntegration({ shouldHandleError: () => false }),
      Sentry.pinoIntegration({
        log: { levels: ["info", "warn", "error", "fatal"] },
        error: { levels: [] },
      }),
    ],
    beforeSend: (event) => scrubEventForSentry(event),
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
  onError?: (error: unknown) => void,
): Promise<T | undefined> {
  const run = async (): Promise<T | undefined> => {
    try {
      return await fn();
    } catch (error) {
      if (!onError) throw error;
      onError(error);
      return undefined;
    }
  };
  if (!enabled) return run();
  return Sentry.startNewTrace(() =>
    Sentry.startSpan({ name, op, attributes }, async (span) => {
      try {
        return await fn();
      } catch (error) {
        span.setStatus({ code: 2, message: "internal_error" });
        if (!onError) throw error;
        onError(error);
        return undefined;
      }
    }),
  );
}

export async function flushMonitoring(timeoutMs = 2000): Promise<boolean> {
  if (!enabled) return true;
  return Sentry.flush(timeoutMs);
}
