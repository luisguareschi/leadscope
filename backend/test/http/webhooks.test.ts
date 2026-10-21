import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
  type TestContext,
  settle,
} from "../support/harness.js";
import {
  kapsoMessageReceived,
  kapsoStatus,
  postKapsoWebhook,
} from "../support/kapso-webhooks.js";

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
afterEach(() => settle(ctx));

const received = (text: string, overrides: { id?: string } = {}) =>
  kapsoMessageReceived({ phoneNumberId: "PNID", text, ...overrides });

const postWebhook = (
  payload: unknown,
  options?: Parameters<typeof postKapsoWebhook>[3],
) => postKapsoWebhook(app, "altamira", payload, options);

describe("Kapso webhook", () => {
  it("rejects a forged, missing, or other-secret signature and stores nothing", async () => {
    const body = JSON.stringify(received("Hola"));
    await postWebhook(body, { signature: "0".repeat(64) }).expect(401);
    await postWebhook(body, { signature: "" }).expect(401);
    await postWebhook(body, { secret: "someone-elses-secret" }).expect(401);
    const tampered = await postWebhook(body, {
      signature: "sha256=" + "a".repeat(64),
    }).expect(401);
    expect(tampered.body.error.code).toBe("invalid_signature");
    expect(await db.message.count()).toBe(0);
  });

  it("refuses every delivery while the company has no webhook secret", async () => {
    await createCompany(db, {
      slug: "sin-secreto",
      phoneNumberId: "PNID-2",
      secrets: { formLeadSecret: "x" },
    });
    await postKapsoWebhook(
      app,
      "sin-secreto",
      kapsoMessageReceived({ phoneNumberId: "PNID-2" }),
    ).expect(401);
    expect(await db.message.count()).toBe(0);
  });

  it("answers 404 for a company that does not exist", async () => {
    await postKapsoWebhook(
      app,
      "nadie",
      kapsoMessageReceived({ phoneNumberId: "PNID" }),
    ).expect(404);
  });

  it("stores the message before answering 200, then replies after the debounce", async () => {
    await postWebhook(received("Hola")).expect(200, { ok: true });
    const stored = await db.message.findMany({
      where: { direction: "inbound" },
    });
    expect(stored).toMatchObject([{ type: "text", body: "Hola" }]);
    expect(
      await db.thread.findFirstOrThrow({ select: { phone: true, name: true } }),
    ).toEqual({ phone: "+59899111222", name: "Ana" });

    await settle(ctx);
    const outbound = await db.message.findMany({
      where: { direction: "outbound" },
    });
    expect(outbound.map((message) => message.body)).toEqual([
      "Respuesta de prueba.",
    ]);
    expect(ctx.integrations.fakes.channel.sent).toMatchObject([
      { to: "59899111222", kind: "text", body: "Respuesta de prueba." },
    ]);
  });

  it("ignores a second delivery of the same message", async () => {
    const payload = received("Hola", { id: "wamid.same" });
    await postWebhook(payload).expect(200);
    await postWebhook(payload).expect(200);
    await settle(ctx);
    expect(await db.message.count({ where: { direction: "inbound" } })).toBe(1);
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
  });

  it("reads a buffered batch and answers the burst once", async () => {
    await postWebhook({
      type: "whatsapp.message.received",
      batch: true,
      data: [received("Hola"), received("busco un 2 dormitorios")],
      batch_info: { size: 2, window_ms: 5000 },
    }).expect(200);
    await settle(ctx);
    expect(
      (
        await db.message.findMany({
          where: { direction: "inbound" },
          orderBy: { sentAt: "asc" },
        })
      ).map((message) => message.body),
    ).toEqual(["Hola", "busco un 2 dormitorios"]);
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
  });

  it("asks a lead who sends only audio to type it", async () => {
    await postWebhook(
      kapsoMessageReceived({
        phoneNumberId: "PNID",
        message: { type: "audio", audio: { id: "media" }, text: undefined },
      }),
    ).expect(200);
    await settle(ctx);
    expect(
      ctx.integrations.fakes.channel.sent.map((sent) => sent.body),
    ).toEqual(["¿Me lo escribís?"]);
  });

  it("does not store history backfills, Business App echoes, or messages with no phone number", async () => {
    await postWebhook(
      kapsoMessageReceived({
        phoneNumberId: "PNID",
        message: {
          kapso: { direction: "inbound", origin: "history_sync" },
        },
      }),
    ).expect(200);
    await postWebhook(
      kapsoMessageReceived({
        phoneNumberId: "PNID",
        message: { kapso: { direction: "outbound", origin: "business_app" } },
      }),
    ).expect(200);
    const bsuidOnly = kapsoMessageReceived({ phoneNumberId: "PNID" });
    delete (bsuidOnly.message as { from?: string }).from;
    delete (bsuidOnly.conversation as { phone_number?: string }).phone_number;
    await postWebhook(bsuidOnly).expect(200);
    expect(await db.message.count()).toBe(0);
  });

  it("applies delivery receipts without moving a status backwards", async () => {
    await postWebhook(received("Hola")).expect(200);
    await settle(ctx);
    const sent = await db.message.findFirstOrThrow({
      where: { direction: "outbound" },
    });
    const receipt = (status: string) =>
      postWebhook(
        kapsoStatus({
          phoneNumberId: "PNID",
          waMessageId: sent.waMessageId!,
          status,
        }),
        { event: `whatsapp.message.${status}` },
      ).expect(200);
    await receipt("read");
    await receipt("delivered");
    expect(
      (await db.message.findUniqueOrThrow({ where: { id: sent.id } })).status,
    ).toBe("read");
  });
});

describe("Kapso webhook routing", () => {
  beforeEach(async () => {
    await createCompany(db, {
      slug: "otra",
      phoneNumberId: "PNID-OTRA",
      secrets: { kapsoWebhookSecret: "otra-secret" },
    });
  });

  it("stores each delivery under the company its URL and number belong to", async () => {
    await postWebhook(received("Hola Altamira")).expect(200);
    await postKapsoWebhook(
      app,
      "otra",
      kapsoMessageReceived({ phoneNumberId: "PNID-OTRA", text: "Hola Otra" }),
      { secret: "otra-secret" },
    ).expect(200);
    const threads = await db.thread.findMany({
      include: { company: { select: { slug: true } }, messages: true },
      orderBy: { createdAt: "asc" },
    });
    expect(
      threads.map((thread) => ({
        company: thread.company.slug,
        bodies: thread.messages
          .filter((message) => message.direction === "inbound")
          .map((message) => message.body),
      })),
    ).toEqual([
      { company: "altamira", bodies: ["Hola Altamira"] },
      { company: "otra", bodies: ["Hola Otra"] },
    ]);
  });

  it("ignores events for another company's number, even when correctly signed", async () => {
    // Altamira's own secret, Altamira's URL, but the other company's number.
    await postWebhook(
      kapsoMessageReceived({ phoneNumberId: "PNID-OTRA", text: "colado" }),
    ).expect(200);
    // The other company's secret is not accepted on Altamira's URL.
    await postWebhook(received("Hola"), { secret: "otra-secret" }).expect(401);
    expect(await db.message.count()).toBe(0);
  });

  it("does not let one company's webhook change another company's receipts", async () => {
    await postKapsoWebhook(
      app,
      "otra",
      kapsoMessageReceived({ phoneNumberId: "PNID-OTRA" }),
      { secret: "otra-secret" },
    ).expect(200);
    await settle(ctx);
    const theirs = await db.message.findFirstOrThrow({
      where: { direction: "outbound" },
    });
    await postWebhook(
      kapsoStatus({
        phoneNumberId: "PNID",
        waMessageId: theirs.waMessageId!,
        status: "read",
      }),
      { event: "whatsapp.message.read" },
    ).expect(200);
    expect(
      (await db.message.findUniqueOrThrow({ where: { id: theirs.id } })).status,
    ).toBe("sent");
  });
});

describe("form-lead hook", () => {
  const hook = "/hooks/crm/form-lead/altamira";

  it("refuses a request without the company's secret", async () => {
    await request(app).post(hook).send({ phone: "099 111 222" }).expect(401);
    await request(app)
      .post(hook)
      .set("X-LeadScope-Secret", "wrong")
      .send({ phone: "099 111 222" })
      .expect(401);
    await request(app)
      .post("/hooks/crm/form-lead/nadie")
      .set("X-LeadScope-Secret", "form-secret")
      .send({})
      .expect(404);
  });

  it("sends the welcome template once to a HubSpot form contact", async () => {
    const response = await request(app)
      .post(hook)
      .set("X-LeadScope-Secret", "form-secret")
      .send({
        phone: "099 111 222",
        email: "Ana@Example.com",
        firstname: "Ana",
        lastname: "Pérez",
        hs_object_id: 9001,
      })
      .expect(200);
    expect(response.body.welcome).toBe("sent");

    const thread = await db.thread.findFirstOrThrow({
      include: { messages: true },
    });
    expect(thread).toMatchObject({
      phone: "+59899111222",
      source: "form",
      state: "qualify",
      name: "Ana Pérez",
      email: "ana@example.com",
      crmContactId: "9001",
    });
    expect(thread.messages).toMatchObject([
      {
        direction: "outbound",
        type: "template",
        body: "¡Hola! Gracias por escribirnos.",
      },
    ]);
    expect(ctx.integrations.fakes.channel.sent).toMatchObject([
      { to: "59899111222", kind: "template", body: "bienvenida" },
    ]);

    const again = await request(app)
      .post(hook)
      .set("Authorization", "Bearer form-secret")
      .send({ phone: "+59899111222" });
    expect(again.body.welcome).toBe("already_in_conversation");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
  });

  it("writes the form lead to the CRM when it arrives, once", async () => {
    await request(app)
      .post(hook)
      .set("X-LeadScope-Secret", "form-secret")
      .send({
        phone: "099 111 222",
        email: "ana@example.com",
        firstname: "Ana",
      })
      .expect(200);
    await ctx.crm.drain();
    const contact = ctx.integrations.fakes.crm.contacts.get("+59899111222");
    expect(contact?.lead).toMatchObject({
      phone: "+59899111222",
      name: "Ana",
      email: "ana@example.com",
    });
    expect(contact?.lead.summary).toContain(
      "Asistente: [template] ¡Hola! Gracias por escribirnos.",
    );
    const thread = await db.thread.findFirstOrThrow();
    expect(thread).toMatchObject({
      crmContactId: "fake-contact-1",
      crmPendingAction: null,
    });

    const syncedAt = thread.crmSyncedAt;
    await request(app)
      .post(hook)
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "099 111 222" })
      .expect(200);
    await ctx.crm.drain();
    expect((await db.thread.findFirstOrThrow()).crmSyncedAt).toEqual(syncedAt);
  });

  it("matches the WhatsApp thread when the lead already wrote", async () => {
    await postWebhook(received("Hola")).expect(200);
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
    const response = await request(app)
      .post(hook)
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "12" })
      .expect(400);
    expect(response.body.error.code).toBe("invalid_phone");
  });
});
