import express from "express";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { errorHandler } from "../../src/http/error-handler.js";
import { HttpError } from "../../src/lib/http-error.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

function memoryLogger() {
  const entries: Array<Record<string, unknown>> = [];
  const logger = pino(
    { level: "debug", base: undefined },
    {
      write(chunk: string) {
        entries.push(JSON.parse(chunk) as Record<string, unknown>);
      },
    },
  );
  return { logger, entries };
}

describe("HTTP request and error logging", () => {
  beforeEach(() => resetDb());

  it("logs 200 requests at info, healthy /health at debug, and 4xx at warn", async () => {
    const db = testDb();
    const company = await createCompany(db);
    await db.operator.create({
      data: {
        companyId: company.id,
        email: "op@test.com",
      },
    });
    const { logger, entries } = memoryLogger();
    const app = createApp(createTestContext({ logger }));

    const health = await request(app).get("/health");
    expect(health.status).toBe(200);

    const ok = await request(app)
      .get("/internal/me?secret=ignore")
      .set("Authorization", "Bearer dev:op@test.com");
    expect(ok.status).toBe(200);

    const unauthorized = await request(app).get("/internal/me");
    expect(unauthorized.status).toBe(401);

    expect(entries).toContainEqual(
      expect.objectContaining({
        level: 20,
        msg: "request",
        method: "GET",
        path: "/health",
        status: 200,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: 30,
        msg: "request",
        method: "GET",
        path: "/internal/me",
        status: 200,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: 40,
        msg: "request",
        method: "GET",
        path: "/internal/me",
        status: 401,
      }),
    );
    expect(entries.filter((entry) => entry.level === 50)).toHaveLength(0);
    expect(JSON.stringify(entries)).not.toContain("secret=ignore");
  });

  it("logs 5xx HttpErrors and unhandled errors at error, but not 4xx HttpErrors", async () => {
    const { logger, entries } = memoryLogger();
    const ctx = createTestContext({ logger });
    const app = express();
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        const fields = {
          method: req.method,
          path: req.originalUrl.split("?")[0],
          status: res.statusCode,
          ms: Date.now() - started,
        };
        if (res.statusCode >= 500) ctx.logger.error(fields, "request");
        else if (res.statusCode >= 400) ctx.logger.warn(fields, "request");
        else ctx.logger.info(fields, "request");
      });
      next();
    });
    app.get("/bad", () => {
      throw new HttpError(400, "Bad input", "bad_input");
    });
    app.get("/upstream", () => {
      throw new HttpError(502, "Upstream failed", "upstream_failed");
    });
    app.get("/crash", () => {
      throw new Error("boom");
    });
    app.use(errorHandler(ctx));

    expect((await request(app).get("/bad")).status).toBe(400);
    expect((await request(app).get("/upstream?phone=123")).status).toBe(502);
    expect((await request(app).get("/crash?email=a@b.com")).status).toBe(500);

    const errors = entries.filter((entry) => entry.level === 50);
    expect(errors).toContainEqual(
      expect.objectContaining({
        msg: "request error",
        method: "GET",
        path: "/upstream",
        status: 502,
        code: "upstream_failed",
      }),
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        msg: "request",
        method: "GET",
        path: "/upstream",
        status: 502,
      }),
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        msg: "unhandled request error",
        method: "GET",
        path: "/crash",
        status: 500,
      }),
    );
    expect(errors).toContainEqual(
      expect.objectContaining({
        msg: "request",
        method: "GET",
        path: "/crash",
        status: 500,
      }),
    );
    expect(errors.some((entry) => entry.path === "/bad")).toBe(false);
    expect(JSON.stringify(entries)).not.toContain("phone=123");
    expect(JSON.stringify(entries)).not.toContain("a@b.com");
  });

  it("logs failing /health requests at error in createApp", async () => {
    const { logger, entries } = memoryLogger();
    const ctx = createTestContext({ logger });
    const spy = vi
      .spyOn(ctx.db, "$queryRaw")
      .mockRejectedValueOnce(new Error("db down"));
    const app = createApp(ctx);

    try {
      const res = await request(app).get("/health");
      expect(res.status).toBe(500);
    } finally {
      spy.mockRestore();
    }

    expect(entries).toContainEqual(
      expect.objectContaining({
        level: 50,
        msg: "unhandled request error",
        method: "GET",
        path: "/health",
        status: 500,
      }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({
        level: 50,
        msg: "request",
        method: "GET",
        path: "/health",
        status: 500,
      }),
    );
  });
});
