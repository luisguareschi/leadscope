import type * as Sentry from "@sentry/node";
import { describe, expect, it, vi } from "vitest";
import { loadEnv } from "../../src/config/env.js";
import {
  DEFAULT_TRACES_SAMPLE_RATE,
  parseTracesSampleRate,
  scrubEventForSentry,
  scrubLogForSentry,
  scrubText,
  shouldSampleTrace,
  withBackgroundTrace,
} from "../../src/lib/monitoring.js";

describe("monitoring", () => {
  describe("parseTracesSampleRate", () => {
    it("defaults to 1 when unset or invalid", () => {
      expect(parseTracesSampleRate(undefined)).toBe(DEFAULT_TRACES_SAMPLE_RATE);
      expect(parseTracesSampleRate("")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
      expect(parseTracesSampleRate("   ")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
      expect(parseTracesSampleRate("abc")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
      expect(parseTracesSampleRate("-0.1")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
      expect(parseTracesSampleRate("1.5")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
    });

    it("parses valid sample rates in [0, 1]", () => {
      expect(parseTracesSampleRate("0")).toBe(0);
      expect(parseTracesSampleRate("0.25")).toBe(0.25);
      expect(parseTracesSampleRate("1")).toBe(1);
    });
  });

  describe("shouldSampleTrace", () => {
    it("drops healthcheck, CORS preflight, and orphan root Prisma traces", () => {
      expect(shouldSampleTrace({ name: "GET /health" }, 1)).toBe(0);
      expect(shouldSampleTrace({ name: "GET /health/" }, 1)).toBe(0);
      expect(
        shouldSampleTrace(
          { name: "GET", attributes: { "url.path": "/health" } },
          1,
        ),
      ).toBe(0);
      expect(shouldSampleTrace({ name: "OPTIONS /internal/threads" }, 1)).toBe(
        0,
      );
      expect(
        shouldSampleTrace(
          {
            name: "/internal/threads",
            attributes: { "http.request.method": "OPTIONS" },
          },
          1,
        ),
      ).toBe(0);
      expect(
        shouldSampleTrace(
          {
            name: "prisma:client:operation",
            attributes: { "sentry.origin": "auto.db.prisma" },
          },
          1,
        ),
      ).toBe(0);
      expect(shouldSampleTrace({ name: "prisma:client:operation" }, 1)).toBe(0);
    });

    it("samples application routes and background tasks at the configured rate", () => {
      expect(
        shouldSampleTrace(
          {
            name: "POST /webhooks/kapso/:slug",
            attributes: {
              "http.request.method": "POST",
              "http.route": "/webhooks/kapso/:slug",
            },
          },
          0.5,
        ),
      ).toBe(0.5);
      expect(shouldSampleTrace({ name: "conversation.turn" }, 1)).toBe(1);
      expect(shouldSampleTrace({ name: "conversation.follow_up" }, 1)).toBe(1);
    });
  });

  describe("scrubLogForSentry", () => {
    it("drops healthcheck logs", () => {
      expect(
        scrubLogForSentry({
          level: "debug",
          message: "request",
          attributes: { method: "GET", path: "/health", status: 200, ms: 2 },
        }),
      ).toBeNull();
    });

    it("preserves Sentry telemetry attributes while recursively redacting PII and secrets", () => {
      const result = scrubLogForSentry({
        level: "error",
        message:
          "failed for ana@example.com +598 99 123 456 with Bearer sk-secret-123",
        attributes: {
          service: "kapso",
          status: 500,
          ms: 142,
          threadId: "thr_123",
          "sentry.sdk.name": "sentry.javascript.node",
          "sentry.environment": "production",
          phone: "+59899123456",
          "lead.email": "ana@example.com",
          Authorization: "Bearer secret",
          err: {
            message: "Contact ana@example.com (+59899123456) failed",
            headers: { authorization: "Bearer top-secret" },
            nested: { email: "nested@example.com", ok: 1 },
          },
        },
      });
      expect(result).toEqual({
        level: "error",
        message:
          "failed for [redacted-email] [redacted-phone] with Bearer [redacted]",
        attributes: {
          service: "kapso",
          status: 500,
          ms: 142,
          threadId: "thr_123",
          "sentry.sdk.name": "sentry.javascript.node",
          "sentry.environment": "production",
          phone: "[redacted]",
          "lead.email": "[redacted]",
          Authorization: "[redacted]",
          err: {
            message: "Contact [redacted-email] ([redacted-phone]) failed",
            headers: "[redacted]",
            nested: { email: "[redacted]", ok: 1 },
          },
        },
      });
    });
  });

  describe("scrubEventForSentry", () => {
    it("scrubs PII and bearer tokens from exception values, messages, breadcrumbs, and extra", () => {
      const event = {
        message: "HubSpot conflict for ana@example.com",
        exception: {
          values: [
            {
              type: "Error",
              value: "Contact +59899123456 failed with Bearer secret-token-999",
            },
          ],
        },
        breadcrumbs: [
          {
            message: "Rejected ana@example.com",
            data: { phone: "+59899123456", status: 409 },
          },
        ],
        extra: {
          headers: { "x-api-key": "kapso-key" },
          threadId: "thr_1",
        },
        contexts: {
          os: { name: "Linux" },
          custom: { email: "ana@example.com", companyId: "cmp_1" },
        },
      } as unknown as Sentry.ErrorEvent;

      const scrubbed = scrubEventForSentry(event);
      expect(scrubbed.message).toBe("HubSpot conflict for [redacted-email]");
      expect(scrubbed.exception?.values?.[0]?.value).toBe(
        "Contact [redacted-phone] failed with Bearer [redacted]",
      );
      expect(scrubbed.breadcrumbs?.[0]).toEqual({
        message: "Rejected [redacted-email]",
        data: { phone: "[redacted]", status: 409 },
      });
      expect(scrubbed.extra).toEqual({
        headers: "[redacted]",
        threadId: "thr_1",
      });
      expect(scrubbed.contexts?.os).toEqual({ name: "Linux" });
      expect(scrubbed.contexts?.custom).toEqual({
        email: "[redacted]",
        companyId: "cmp_1",
      });
    });

    it("does not mangle ISO timestamps or opaque IDs", () => {
      expect(scrubText("2026-11-27T17:15:00Z thread=thr_1234567890")).toBe(
        "2026-11-27T17:15:00Z thread=thr_1234567890",
      );
    });
  });

  describe("withBackgroundTrace", () => {
    it("runs the callback directly when monitoring is disabled", async () => {
      const value = await withBackgroundTrace(
        "conversation.turn",
        "task.turn",
        { "leadscope.thread_id": "thr_1" },
        async () => 42,
      );
      expect(value).toBe(42);
    });

    it("routes failures to onError when provided", async () => {
      const onError = vi.fn();
      const boom = new Error("boom");
      const value = await withBackgroundTrace(
        "conversation.turn",
        "task.turn",
        { "leadscope.thread_id": "thr_1" },
        async () => {
          throw boom;
        },
        onError,
      );
      expect(value).toBeUndefined();
      expect(onError).toHaveBeenCalledWith(boom);
    });
  });

  describe("loadEnv Sentry whitespace handling", () => {
    const base = {
      DATABASE_URL: "postgresql://x",
      SECRETS_ENCRYPTION_KEY: "k",
    };

    it("treats whitespace-only SENTRY_DSN and SENTRY_TRACES_SAMPLE_RATE as unset", () => {
      const env = loadEnv({
        ...base,
        SENTRY_DSN: "   ",
        SENTRY_TRACES_SAMPLE_RATE: "   ",
      });
      expect(env.SENTRY_DSN).toBeUndefined();
      expect(env.SENTRY_TRACES_SAMPLE_RATE).toBe(1);
    });
  });
});
