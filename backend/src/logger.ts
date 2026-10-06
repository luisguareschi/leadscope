import pino from "pino";

export const log = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "phone",
      "body",
      "req.headers.authorization",
      "secrets",
      "apiKey",
      "accessToken",
      "summary",
    ],
    remove: true,
  },
});

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/node");
  Sentry.init({ dsn, tracesSampleRate: 0 });
}

export async function captureError(
  err: unknown,
  context: Record<string, string | number | boolean | null>,
): Promise<void> {
  log.error({ err, ...context }, "error");
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/node");
  Sentry.captureException(err, { extra: context });
}
