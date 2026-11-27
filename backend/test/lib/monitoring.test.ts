import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRACES_SAMPLE_RATE,
  parseTracesSampleRate,
  scrubLogForSentry,
  shouldSampleTrace,
  withBackgroundTrace,
} from "../../src/lib/monitoring.js";

describe("monitoring", () => {
  describe("parseTracesSampleRate", () => {
    it("defaults to 1 when unset or invalid", () => {
      expect(parseTracesSampleRate(undefined)).toBe(DEFAULT_TRACES_SAMPLE_RATE);
      expect(parseTracesSampleRate("")).toBe(DEFAULT_TRACES_SAMPLE_RATE);
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
    it("drops healthcheck and CORS preflight requests", () => {
      expect(shouldSampleTrace({ name: "GET /health" }, 1)).toBe(0);
      expect(shouldSampleTrace({ name: "GET /health/" }, 1)).toBe(0);
      expect(
        shouldSampleTrace({ attributes: { "url.path": "/health" } }, 1),
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

    it("redacts sensitive Ley 18.331 attributes while preserving operational fields", () => {
      const result = scrubLogForSentry({
        level: "info",
        message: "outbound request",
        attributes: {
          service: "kapso",
          status: 200,
          ms: 142,
          threadId: "thr_123",
          phone: "+59899123456",
          "lead.email": "ana@example.com",
          Authorization: "Bearer secret",
        },
      });
      expect(result).toEqual({
        level: "info",
        message: "outbound request",
        attributes: {
          service: "kapso",
          status: 200,
          ms: 142,
          threadId: "thr_123",
          phone: "[redacted]",
          "lead.email": "[redacted]",
          Authorization: "[redacted]",
        },
      });
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
  });
});
