import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { buildCrmSummary } from "../../src/conversation/crm-summary.js";
import { processThread } from "../../src/conversation/process-thread.js";
import { ADVISOR_LABEL } from "../../src/engine/history.js";
import {
  ChannelError,
  FakeChannel,
  type Channel,
} from "../../src/integrations/whatsapp/channel.js";
import {
  baseConfig,
  createCompany,
  createTestContext,
  inbound,
  resetDb,
  settle,
  testDb,
  type TestContext,
} from "../support/harness.js";

const db = testDb();
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;
let otherCompanyId: string;
let pnid: string;
let ana: string;
let bruno: string;

const asAna = { Authorization: "Bearer dev:ana@altamira.uy" };

const asArchived = { Authorization: "Bearer dev:ex@altamira.uy" };
const asOther = { Authorization: "Bearer dev:operador@otra.uy" };
const admin = { Authorization: "Bearer dev:admin@example.com" };

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000);

async function makeThread(data: Record<string, unknown> = {}) {
  return db.thread.create({
    data: {
      companyId,
      phone: "+59899111222",
      waId: "59899111222",
      name: "Ana Lead",
      lastInboundAt: hoursAgo(1),
      lastMessageAt: hoursAgo(1),
      ...data,
    },
  });
}

function send(threadId: string, body: object, as = asAna) {
  return request(app)
    .post(`/internal/threads/${threadId}/messages`)
    .set(as)
    .send(body);
}

function setup(channel?: Channel) {
  ctx = createTestContext({
    env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
    ...(channel ? { integrations: { channelFor: () => channel } } : {}),
  });
  app = createApp(ctx);
}

beforeEach(async () => {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    name: "Altamira",
  });
  companyId = company.id;
  pnid = company.whatsappPhoneNumberId!;
  otherCompanyId = (await createCompany(db, { slug: "otra" })).id;
  ana = (
    await db.operator.create({ data: { email: "ana@altamira.uy", companyId } })
  ).id;
  bruno = (
    await db.operator.create({
      data: { email: "bruno@altamira.uy", companyId },
    })
  ).id;
  await db.operator.create({
    data: { email: "ex@altamira.uy", companyId, archivedAt: new Date() },
  });
  await db.operator.create({
    data: { email: "operador@otra.uy", companyId: otherCompanyId },
  });
  setup();
});

describe("an operator writes to the lead from the thread view", () => {
  it("sends through the company's number, stores who wrote it, and takes the thread over", async () => {
    const thread = await makeThread({ stage: "to_contact", state: "handoff" });
    const response = await send(thread.id, {
      body: "  Hola Ana, soy *Ana* de _Altamira_.  ",
    }).expect(201);

    expect(ctx.integrations.fakes.channel.sent).toMatchObject([
      {
        to: "59899111222",
        kind: "text",
        body: "Hola Ana, soy *Ana* de _Altamira_.",
      },
    ]);
    expect(response.body.message).toMatchObject({
      direction: "outbound",
      type: "text",
      body: "Hola Ana, soy *Ana* de _Altamira_.",
      status: "sent",
      error: null,
      sentBy: { email: "ana@altamira.uy", support: false },
    });
    expect(response.body.thread).toMatchObject({
      paused: true,
      botActivity: "paused",
      assignee: { id: ana },
      stage: "to_contact",
      lastMessagePreview: "Hola Ana, soy *Ana* de _Altamira_.",
    });
    const stored = await db.message.findFirstOrThrow({
      where: { direction: "outbound" },
    });
    expect(stored).toMatchObject({ sentById: ana, sentBySupport: false });
    expect(stored.waMessageId).toMatch(/^wamid\.fake\./);

    const detail = await request(app)
      .get(`/internal/threads/${thread.id}`)
      .set(asAna)
      .expect(200);
    expect(detail.body.messages.at(-1).sentBy).toEqual({
      email: "ana@altamira.uy",
      support: false,
    });
  });

  it("clears Requiere asesor, so the thread reads Pausado", async () => {
    const thread = await makeThread({
      needsHuman: true,
      needsHumanReason: "lead_needs_human",
    });
    const response = await send(thread.id, { body: "Te ayudo yo." }).expect(
      201,
    );
    expect(response.body.thread).toMatchObject({
      needsHuman: false,
      needsHumanReason: null,
      paused: true,
      botActivity: "paused",
    });
  });

  it("assigns only a thread nobody has, and keeps an existing assignee", async () => {
    const unassigned = await makeThread();
    await send(unassigned.id, { body: "Hola" }).expect(201);
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: unassigned.id } }))
        .assignedToId,
    ).toBe(ana);

    const assignedAt = hoursAgo(5);
    const brunos = await makeThread({
      phone: "+59899000002",
      waId: "59899000002",
      assignedToId: bruno,
      assignedAt,
    });
    const response = await send(brunos.id, { body: "Hola" }).expect(201);
    expect(response.body.thread.assignee).toMatchObject({ id: bruno });
    expect(
      await db.thread.findUniqueOrThrow({ where: { id: brunos.id } }),
    ).toMatchObject({ assignedToId: bruno, assignedAt });
  });

  it("never changes the stage, its last change, or the handoff time", async () => {
    for (const stage of [
      "qualifying",
      "to_contact",
      "contacted",
      "not_interested",
    ] as const) {
      await db.thread.deleteMany();
      const handedOffAt = stage === "to_contact" ? hoursAgo(2) : null;
      const thread = await makeThread({ stage, handedOffAt });
      await send(thread.id, { body: "Hola" }).expect(201);
      expect(
        await db.thread.findUniqueOrThrow({ where: { id: thread.id } }),
      ).toMatchObject({ stage, handedOffAt, stageChangedAt: null });
    }
    expect(await db.leadStageChange.count()).toBe(0);
  });

  it("marks lead messages waiting for the bot as handled, so the bot does not answer them", async () => {
    const thread = await makeThread();
    await db.message.create({
      data: {
        companyId,
        threadId: thread.id,
        direction: "inbound",
        type: "text",
        body: "¿Hay garage?",
        sentAt: hoursAgo(0.01),
      },
    });
    await send(thread.id, { body: "Sí, hay garage." }).expect(201);
    await expect(processThread(ctx, thread.id)).resolves.toBe("no_pending");
    expect(ctx.llm.calls).toHaveLength(0);
  });

  it("rejects an empty or too long message, and extra fields", async () => {
    const thread = await makeThread();
    await send(thread.id, { body: "   \n " }).expect(400);
    await send(thread.id, { body: "x".repeat(4097) }).expect(400);
    await send(thread.id, { body: "Hola", companyId: otherCompanyId }).expect(
      400,
    );
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: thread.id } })).paused,
    ).toBe(false);
  });
});

describe("the 24-hour window", () => {
  it("refuses a message 24 hours after the lead's last one, and sends nothing", async () => {
    const thread = await makeThread({ lastInboundAt: hoursAgo(24.01) });
    const response = await send(thread.id, { body: "Hola" }).expect(409);
    expect(response.body.error.code).toBe("reply_window_closed");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
    expect(
      await db.thread.findUniqueOrThrow({ where: { id: thread.id } }),
    ).toMatchObject({ paused: false, assignedToId: null });
    expect(await db.message.count()).toBe(0);
  });

  it("refuses a lead who never wrote (a form lead with only the welcome)", async () => {
    const thread = await makeThread({ lastInboundAt: null, source: "form" });
    await send(thread.id, { body: "Hola" }).expect(409);
  });

  it("still sends just inside the window", async () => {
    const thread = await makeThread({ lastInboundAt: hoursAgo(23.9) });
    await send(thread.id, { body: "Hola" }).expect(201);
  });
});

describe("company scoping and who may send", () => {
  it("is a 404 for another company's thread, and sends nothing", async () => {
    const thread = await makeThread();
    await send(thread.id, { body: "Hola" }, asOther).expect(404);
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: thread.id } })).paused,
    ).toBe(false);
  });

  it("refuses an archived operator", async () => {
    const thread = await makeThread();
    const response = await send(thread.id, { body: "Hola" }, asArchived).expect(
      403,
    );
    expect(response.body.error.code).toBe("operator_archived");
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(0);
  });

  it("lets a platform admin send through support access: labeled with their email, unassigned, audited", async () => {
    const thread = await makeThread();
    const response = await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(admin)
      .set({ "X-Company-Id": companyId })
      .send({ body: "Hola, soporte." })
      .expect(201);
    expect(response.body.message.sentBy).toEqual({
      email: "admin@example.com",
      support: true,
    });
    expect(response.body.thread).toMatchObject({
      paused: true,
      assignee: null,
    });
    const stored = await db.message.findFirstOrThrow({
      where: { direction: "outbound" },
    });
    expect(stored).toMatchObject({
      sentById: null,
      sentByEmail: "admin@example.com",
      sentBySupport: true,
    });
    const audit = await db.adminAuditEntry.findMany();
    expect(audit).toMatchObject([
      {
        adminEmail: "admin@example.com",
        companyId,
        action: `POST /internal/threads/${thread.id}/messages`,
        status: 201,
      },
    ]);
  });
});

describe("a send WhatsApp refuses", () => {
  it("is stored as failed with the reason, and the thread is still taken over", async () => {
    const failing = new FakeChannel();
    failing.sendText = async () => {
      throw new ChannelError("Re-engagement message", 131047);
    };
    setup(failing);
    const thread = await makeThread({ needsHuman: true });
    const response = await send(thread.id, { body: "Hola" }).expect(201);
    expect(response.body.message).toMatchObject({
      status: "failed",
      error: "Re-engagement message",
    });
    expect(response.body.thread).toMatchObject({
      paused: true,
      needsHuman: false,
      assignee: { id: ana },
    });
  });
});

describe("after an advisor wrote", () => {
  async function receive(body: string) {
    const result = await recordInboundMessage(ctx, inbound(pnid, { body }));
    if (result.status !== "recorded") throw new Error(result.status);
    return result.threadId;
  }

  it("the bot stays quiet; once resumed, the prompt labels the advisor's messages", async () => {
    const threadId = await receive("Hola, busco un 2 dormitorios");
    ctx.llm.push({ reply: "¡Hola! ¿Con qué presupuesto contás?" });
    await expect(processThread(ctx, threadId)).resolves.toBe("replied");

    await send(threadId, { body: "Hola, soy Ana. ¿Te llamo mañana?" }).expect(
      201,
    );
    await receive("Dale, mañana a las 10");
    await expect(processThread(ctx, threadId)).resolves.toBe("no_pending");
    expect(ctx.llm.calls).toHaveLength(1);

    await request(app)
      .post(`/internal/threads/${threadId}/resume`)
      .set(asAna)
      .expect(200);
    await receive("¿Y tienen garage?");
    await expect(processThread(ctx, threadId)).resolves.toBe("replied");
    const call = ctx.llm.calls[1]!;
    expect(call.messages).toEqual([
      { role: "user", content: "Hola, busco un 2 dormitorios" },
      {
        role: "assistant",
        content: `¡Hola! ¿Con qué presupuesto contás?\n${ADVISOR_LABEL} Hola, soy Ana. ¿Te llamo mañana?`,
      },
      {
        role: "user",
        content: "Dale, mañana a las 10\n¿Y tienen garage?",
      },
    ]);
    expect(call.system).toContain(
      `their messages start with "${ADVISOR_LABEL}"`,
    );
    await settle(ctx);
  });

  it("a turn that was answering when the advisor wrote drops its reply", async () => {
    const threadId = await receive("Hola");
    ctx.llm.push(async () => {
      await send(threadId, { body: "Hola, te escribe Ana." }).expect(201);
      return { reply: "¡Hola! Soy Sofía." };
    });
    await expect(processThread(ctx, threadId)).resolves.toBe("silenced");
    expect(
      ctx.integrations.fakes.channel.sent.map((sent) => sent.body),
    ).toEqual(["Hola, te escribe Ana."]);
    await settle(ctx);
  });
});

describe("the HubSpot transcript", () => {
  it("labels an operator's message with their name, and an admin's with their email", () => {
    const at = new Date("2026-10-22T15:00:00Z");
    const text = buildCrmSummary({
      thread: {
        phone: "+59899111222",
        name: "Ana Lead",
        email: null,
        state: "answer",
        stage: "qualifying",
        collected: {},
        summary: null,
        callTime: null,
        needsHuman: false,
        needsHumanReason: null,
      },
      messages: [
        { direction: "inbound", type: "text", body: "Hola", sentAt: at },
        { direction: "outbound", type: "text", body: "¡Hola!", sentAt: at },
        {
          direction: "outbound",
          type: "text",
          body: "Te llamo mañana.",
          sentAt: at,
          sentByEmail: "ana@altamira.uy",
          sentBySupport: false,
        },
        {
          direction: "outbound",
          type: "text",
          body: "Soporte.",
          sentAt: at,
          sentByEmail: "admin@example.com",
          sentBySupport: true,
        },
      ],
      config: parseCompanyConfig(baseConfig),
      now: at,
    });
    expect(text).toContain("Lead: Hola");
    expect(text).toContain("Asistente: ¡Hola!");
    expect(text).toContain("Asesor ana: Te llamo mañana.");
    expect(text).toContain("Asesor admin@example.com: Soporte.");
  });
});
