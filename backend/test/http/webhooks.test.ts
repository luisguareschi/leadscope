import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { signWebhookBody } from "../../src/integrations/whatsapp/signature.js";
import { createCompany, createTestContext, resetDb, testDb, type TestContext } from "../support/harness.js";
import { TEST_APP_SECRET } from "../support/test-env.js";

const db = testDb();
let ctx: TestContext;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDb();
  await createCompany(db, { slug: "altamira", phoneNumberId: "PNID" });
  ctx = createTestContext();
  app = createApp(ctx);
});

// Replies run in the background after the 200; finish them before the next test truncates the tables.
afterEach(() => ctx.replies.drain());

function whatsappPayload(text: string, id = `wamid.${Date.now()}`) {
  return JSON.stringify({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "PNID" },
              contacts: [{ wa_id: "59899111222", profile: { name: "Ana" } }],
              messages: [{ from: "59899111222", id, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: text } }],
            },
          },
        ],
      },
    ],
  });
}

const postWebhook = (body: string, signature = signWebhookBody(body, TEST_APP_SECRET)) =>
  request(app)
    .post("/webhooks/whatsapp")
    .set({ "Content-Type": "application/json", "X-Hub-Signature-256": signature })
    .send(body);

describe("WhatsApp webhook", () => {
  it("answers Meta's verification handshake only with the right token", async () => {
    const ok = await request(app)
      .get("/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "test-verify-token", "hub.challenge": "1234" })
      .expect(200);
    expect(ok.text).toBe("1234");
    await request(app)
      .get("/webhooks/whatsapp")
      .query({ "hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "1234" })
      .expect(403);
  });

  it("rejects a payload without Meta's signature", async () => {
    await postWebhook(whatsappPayload("Hola"), "sha256=forged").expect(401);
    expect(await db.message.count()).toBe(0);
  });

  it("stores the message before answering 200, then replies after the debounce", async () => {
    await postWebhook(whatsappPayload("Hola")).expect(200, { ok: true });
    expect(await db.message.count({ where: { direction: "inbound" } })).toBe(1);

    await ctx.replies.drain();
    const outbound = await db.message.findMany({ where: { direction: "outbound" } });
    expect(outbound.map((message) => message.body)).toEqual(["Respuesta de prueba."]);
  });

  it("applies delivery receipts without moving a status backwards", async () => {
    const body = whatsappPayload("Hola");
    await postWebhook(body).expect(200);
    await ctx.replies.drain();
    const sent = await db.message.findFirstOrThrow({ where: { direction: "outbound" } });
    const receipt = (status: string) =>
      JSON.stringify({
        entry: [{ changes: [{ value: { metadata: { phone_number_id: "PNID" }, statuses: [{ id: sent.waMessageId, status }] } }] }],
      });
    await postWebhook(receipt("read")).expect(200);
    await postWebhook(receipt("delivered")).expect(200);
    expect((await db.message.findUniqueOrThrow({ where: { id: sent.id } })).status).toBe("read");
  });
});

describe("form-lead hook", () => {
  const hook = "/hooks/crm/form-lead/altamira";

  it("refuses a request without the company's secret", async () => {
    await request(app).post(hook).send({ phone: "099 111 222" }).expect(401);
    await request(app).post(hook).set("X-LeadScope-Secret", "wrong").send({ phone: "099 111 222" }).expect(401);
    await request(app).post("/hooks/crm/form-lead/nadie").set("X-LeadScope-Secret", "form-secret").send({}).expect(404);
  });

  it("sends the welcome template once to a HubSpot form contact", async () => {
    const response = await request(app)
      .post(hook)
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "099 111 222", email: "Ana@Example.com", firstname: "Ana", lastname: "Pérez", hs_object_id: 9001 })
      .expect(200);
    expect(response.body.welcome).toBe("sent");

    const thread = await db.thread.findFirstOrThrow({ include: { messages: true } });
    expect(thread).toMatchObject({
      phone: "+59899111222",
      source: "form",
      state: "qualify",
      name: "Ana Pérez",
      email: "ana@example.com",
      crmContactId: "9001",
    });
    expect(thread.messages).toMatchObject([{ direction: "outbound", type: "template", body: "¡Hola! Gracias por escribirnos." }]);
    expect(ctx.integrations.fakes.channel.sent).toMatchObject([{ to: "59899111222", kind: "template", body: "bienvenida" }]);

    const again = await request(app).post(hook).set("Authorization", "Bearer form-secret").send({ phone: "+59899111222" });
    expect(again.body.welcome).toBe("already_in_conversation");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
  });

  it("matches the WhatsApp thread when the lead already wrote", async () => {
    await postWebhook(whatsappPayload("Hola")).expect(200);
    const response = await request(app)
      .post(hook)
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "+598 99 111 222", email: "ana@example.com" })
      .expect(200);
    expect(response.body.welcome).toBe("already_in_conversation");
    expect(await db.thread.count()).toBe(1);
    expect((await db.thread.findFirstOrThrow()).email).toBe("ana@example.com");
  });

  it("rejects a payload with no valid phone", async () => {
    const response = await request(app).post(hook).set("X-LeadScope-Secret", "form-secret").send({ phone: "12" }).expect(400);
    expect(response.body.error.code).toBe("invalid_phone");
  });
});
