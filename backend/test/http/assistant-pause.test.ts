import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { processThread } from "../../src/conversation/process-thread.js";
import { sweepOnce } from "../../src/conversation/sweeper.js";
import type { LlmClient } from "../../src/llm/types.js";
import {
  createCompany,
  createTestContext,
  inbound,
  resetDb,
  settle,
  testDb,
  type TestContext,
} from "../support/harness.js";
import {
  kapsoMessageReceived,
  postKapsoWebhook,
} from "../support/kapso-webhooks.js";

const db = testDb();
const operator = { Authorization: "Bearer dev:operador@altamira.uy" };
const admin = { Authorization: "Bearer dev:admin@example.com" };
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;
let pnid: string;

async function setup(llm?: LlmClient) {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    hubspotEnabled: true,
  });
  companyId = company.id;
  pnid = company.whatsappPhoneNumberId!;
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId },
  });
  ctx = createTestContext({
    env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
    ...(llm ? { integrations: { llmFor: () => llm } } : {}),
  });
  app = createApp(ctx);
}

function postKapsoText(from: string, body: string, waMessageId: string) {
  return postKapsoWebhook(
    app,
    "altamira",
    kapsoMessageReceived({
      phoneNumberId: pnid,
      from,
      text: body,
      id: waMessageId,
    }),
  );
}

afterEach(() => settle(ctx));

describe("company-wide assistant pause", () => {
  beforeEach(() => setup());

  it("pauses and resumes via settings, updates /me and /settings, and is idempotent", async () => {
    const first = await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: true })
      .expect(200);
    expect(first.body.assistant).toMatchObject({
      paused: true,
      pausedByEmail: "operador@altamira.uy",
    });
    expect(first.body.assistant.pausedAt).toEqual(expect.any(String));

    // Second pause preserves original pausedAt and pausedByEmail.
    const second = await request(app)
      .put("/internal/settings/assistant-paused")
      .set(admin)
      .set("X-Company-Id", companyId)
      .send({ paused: true })
      .expect(200);
    expect(second.body.assistant).toEqual(first.body.assistant);

    const me = await request(app).get("/internal/me").set(operator).expect(200);
    expect(me.body.company).toMatchObject({
      assistantPaused: true,
      assistantPausedAt: first.body.assistant.pausedAt,
      assistantPausedByEmail: "operador@altamira.uy",
    });

    const settings = await request(app)
      .get("/internal/settings")
      .set(operator)
      .expect(200);
    expect(settings.body.assistant).toEqual(first.body.assistant);

    const resumed = await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: false })
      .expect(200);
    expect(resumed.body.assistant).toEqual({
      paused: false,
      pausedAt: null,
      pausedByEmail: null,
    });
  });

  it("stores inbound WhatsApp messages and syncs HubSpot without replying while paused", async () => {
    await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: true })
      .expect(200);

    await postKapsoText("59899111222", "Hola, quiero info", "wamid-1").expect(
      200,
    );
    await settle(ctx);

    const messages = await db.message.findMany();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      direction: "inbound",
      body: "Hola, quiero info",
    });
    expect(messages[0]?.handledAt).not.toBeNull();
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
    // Lead is still captured in HubSpot on first message.
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(1);
  });

  it("marks pending messages handled on pause, preserves per-thread flags, and does not backfill on resume", async () => {
    // Thread A: active, has a pending unhandled message when pause happens.
    const a = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111001",
        body: "Antes de pausar",
        waMessageId: "wamid-a1",
      }),
    );
    if (a.status !== "recorded") throw new Error(a.status);
    expect(a.needsReply).toBe(true);

    // Thread B: individually paused by an advisor.
    const b = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111002",
        body: "Hola",
        waMessageId: "wamid-b1",
      }),
    );
    if (b.status !== "recorded") throw new Error(b.status);
    await request(app)
      .post(`/internal/threads/${b.threadId}/pause`)
      .set(operator)
      .expect(200);

    // Pause globally before Thread A runs.
    await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: true })
      .expect(200);

    // Thread A's pending message is now handled; processing produces no reply.
    expect(await processThread(ctx, a.threadId)).toBe("no_pending");

    // Another message arrives while paused.
    const aPaused = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111001",
        body: "Durante la pausa",
        waMessageId: "wamid-a2",
      }),
    );
    expect(aPaused).toMatchObject({ status: "recorded", needsReply: false });

    // Resume globally: neither the pre-pause nor during-pause messages are backfilled.
    await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: false })
      .expect(200);
    await sweepOnce(ctx);
    await settle(ctx);
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);

    // Thread B is still individually paused; its next message gets no reply.
    const bAfter = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111002",
        body: "Sigo acá",
        waMessageId: "wamid-b2",
      }),
    );
    expect(bAfter).toMatchObject({ status: "recorded", needsReply: false });

    // Thread A's next message after resume DOES get a normal assistant reply.
    const aAfter = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111001",
        body: "Hola de nuevo",
        waMessageId: "wamid-a3",
      }),
    );
    expect(aAfter).toMatchObject({ status: "recorded", needsReply: true });
    expect(await processThread(ctx, a.threadId)).toBe("replied");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
  });

  it("aborts a turn that is already in-flight when paused before LLM or during LLM", async () => {
    // Case 1: paused before processThread starts (message still unhandled in DB).
    const first = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111333",
        body: "Hola",
        waMessageId: "wamid-r1",
      }),
    );
    if (first.status !== "recorded") throw new Error(first.status);
    await db.company.update({
      where: { id: companyId },
      data: { assistantPaused: true },
    });
    expect(await processThread(ctx, first.threadId)).toBe("company_paused");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);

    // Case 2: paused while the model call is in-flight.
    let releaseLlm!: () => void;
    let llmStarted!: () => void;
    const startedPromise = new Promise<void>((resolve) => {
      llmStarted = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      releaseLlm = resolve;
    });
    const slowLlm: LlmClient = {
      kind: "fake",
      async complete() {
        llmStarted();
        await gate;
        return {
          output: {
            reply: "Respuesta que no debe salir",
            collected: {},
            callTime: null,
            intent: "continue",
            callNow: false,
            needsHuman: false,
            forbiddenTopic: null,
            summary: "• Hola",
          },
          usage: {
            model: "claude-haiku-4-5",
            inputTokens: 10,
            outputTokens: 10,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
            latencyMs: 10,
          },
        };
      },
    };
    await setup(slowLlm);
    const second = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111444",
        body: "Hola",
        waMessageId: "wamid-r2",
      }),
    );
    if (second.status !== "recorded") throw new Error(second.status);

    const turnPromise = processThread(ctx, second.threadId);
    await startedPromise;
    await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: true })
      .expect(200);
    releaseLlm();

    expect(await turnPromise).toBe("company_paused");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
    const outbound = await db.message.count({
      where: { threadId: second.threadId, direction: "outbound" },
    });
    expect(outbound).toBe(0);
  });

  it("skips form-lead welcome template while paused but still stores the lead and syncs CRM", async () => {
    await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: true })
      .expect(200);

    const res = await request(app)
      .post("/hooks/crm/form-lead/altamira")
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "099 222 333", firstname: "Camila" })
      .expect(200);
    await settle(ctx);

    expect(res.body.welcome).toBe("assistant_paused");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
    expect(await db.thread.count()).toBe(1);
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(1);
  });

  it("still allows manual advisor messages and Probar asistente while paused", async () => {
    const rec = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111555",
        body: "Hola",
        waMessageId: "wamid-m1",
      }),
    );
    if (rec.status !== "recorded") throw new Error(rec.status);

    await request(app)
      .put("/internal/settings/assistant-paused")
      .set(operator)
      .send({ paused: true })
      .expect(200);

    await request(app)
      .post(`/internal/threads/${rec.threadId}/messages`)
      .set(operator)
      .send({ body: "Te escribo yo personalmente" })
      .expect(201);
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
    expect(ctx.integrations.fakes.channel.sent[0]?.body).toBe(
      "Te escribo yo personalmente",
    );

    const testTurn = await request(app)
      .post("/internal/assistant-test/turn")
      .set(operator)
      .send({ messages: [{ role: "lead", body: "Hola, busco 2 dormitorios" }] })
      .expect(200);
    expect(testTurn.body.reply).toEqual(expect.any(String));
    expect(testTurn.body.reply.length).toBeGreaterThan(0);
  });

  it("skips paused companies in the sweeper", async () => {
    const rec = await recordInboundMessage(
      ctx,
      inbound(pnid, {
        from: "59899111666",
        body: "Hola",
        waMessageId: "wamid-s1",
      }),
    );
    if (rec.status !== "recorded") throw new Error(rec.status);
    // Backdate createdAt so sweeper would normally pick it up.
    await db.message.updateMany({
      where: { threadId: rec.threadId },
      data: { createdAt: new Date(Date.now() - 60_000) },
    });
    await db.company.update({
      where: { id: companyId },
      data: { assistantPaused: true },
    });

    const swept = await sweepOnce(ctx);
    expect(swept.scheduled).toBe(0);
  });

  it("lets platform admins view and toggle pause from Empresas and audits both paths", async () => {
    await request(app)
      .put(`/internal/companies/${companyId}/assistant-paused`)
      .set(operator)
      .send({ paused: true })
      .expect(403);

    const paused = await request(app)
      .put(`/internal/companies/${companyId}/assistant-paused`)
      .set(admin)
      .send({ paused: true })
      .expect(200);
    expect(paused.body.company).toMatchObject({
      id: companyId,
      assistantPaused: true,
      assistantPausedByEmail: "admin@example.com",
    });

    const list = await request(app)
      .get("/internal/companies")
      .set(admin)
      .expect(200);
    expect(list.body.companies[0]).toMatchObject({
      id: companyId,
      assistantPaused: true,
      assistantPausedByEmail: "admin@example.com",
    });

    // Support access path is also audited.
    await request(app)
      .put("/internal/settings/assistant-paused")
      .set(admin)
      .set("X-Company-Id", companyId)
      .send({ paused: false })
      .expect(200);

    const audits = await db.adminAuditEntry.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(audits.map((entry) => entry.action)).toEqual([
      `PUT /internal/companies/${companyId}/assistant-paused`,
      "PUT /internal/settings/assistant-paused",
    ]);

    // Archived company cannot toggle pause from Empresas.
    await request(app)
      .post(`/internal/companies/${companyId}/archive`)
      .set(admin)
      .expect(200);
    await request(app)
      .put(`/internal/companies/${companyId}/assistant-paused`)
      .set(admin)
      .send({ paused: true })
      .expect(409);
  });
});
