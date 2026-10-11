import * as Sentry from "@sentry/node";

let enabled = false;

export function initMonitoring(dsn: string | undefined, environment: string): void {
  if (!dsn) return;
  Sentry.init({ dsn, environment });
  enabled = true;
}

export function reportError(error: unknown): void {
  if (enabled) Sentry.captureException(error);
}
