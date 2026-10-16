import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

const db = testDb();
const operator = { Authorization: "Bearer dev:operador@altamira.uy" };

const kapsoFetch = vi.fn(async (url: string | URL | Request) =>
  String(url).includes("/health")
    ? Response.json({ status: "healthy", checks: {} })
    : Response.json({
        data: [
          {
            url: "https://api.example.com/webhooks/kapso/altamira",
            kind: "kapso",
            active: true,
            payload_version: "v2",
            secret_key: "hook-secret",
            events: [
              "whatsapp.message.received",
              "whatsapp.message.sent",
              "whatsapp.message.delivered",
              "whatsapp.message.read",
              "whatsapp.message.failed",
            ],
          },
        ],
      }),
);

async function setup(secrets: Record<string, string>, phoneNumberId?: string) {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    phoneNumberId,
    secrets,
  });
  if (phoneNumberId === undefined)
    await db.company.update({
      where: { id: company.id },
      data: { whatsappPhoneNumberId: null },
    });
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId: company.id },
  });
  return createApp(
    createTestContext({
      integrations: { kapsoFetch: kapsoFetch as typeof fetch },
    }),
  );
}

describe("WhatsApp connection check", () => {
  beforeEach(() => kapsoFetch.mockClear());

  it("lists what is missing and does not call Kapso without a key and number", async () => {
    const app = await setup({});
    const response = await request(app)
      .get("/internal/whatsapp/connection-check")
      .set(operator)
      .expect(200);
    expect(response.body.webhookPath).toBe("/webhooks/kapso/altamira");
    expect(response.body.ready).toBe(false);
    expect(
      response.body.checks.map((check: { id: string; status: string }) => [
        check.id,
        check.status,
      ]),
    ).toEqual([
      ["phoneNumberId", "error"],
      ["apiKey", "error"],
      ["webhookSecret", "error"],
      ["number", "skipped"],
      ["webhook", "skipped"],
    ]);
    expect(kapsoFetch).not.toHaveBeenCalled();
  });

  it("is ready when the saved values and Kapso agree", async () => {
    const app = await setup(
      { kapsoApiKey: "kapso-key", kapsoWebhookSecret: "hook-secret" },
      "647015955153740",
    );
    const response = await request(app)
      .get("/internal/whatsapp/connection-check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(true);
    expect(kapsoFetch).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(response.body)).not.toContain("hook-secret");
    expect(JSON.stringify(response.body)).not.toContain("kapso-key");
  });

  it("needs a signed-in operator", async () => {
    const app = await setup({});
    await request(app).get("/internal/whatsapp/connection-check").expect(401);
  });
});
