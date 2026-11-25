import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  WHATSAPP_SERVICE_USD,
  WHATSAPP_TEMPLATE_USD,
} from "../../src/features/metrics/pricing.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
  type TestContext,
} from "../support/harness.js";

const db = testDb();
const NOW = new Date("2026-11-09T15:00:00.000Z");
const RANGE = "from=2026-11-01&to=2026-11-08";

let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;
let otherCompanyId: string;
let anaId: string;
let phoneN = 0;

const asAna = { Authorization: "Bearer dev:ana@altamira.uy" };
const admin = { Authorization: "Bearer dev:admin@example.com" };
const stranger = { Authorization: "Bearer dev:nadie@example.com" };

function metrics(query = "", headers: Record<string, string> = asAna) {
  const path = query ? `/internal/metrics?${query}` : "/internal/metrics";
  return request(app).get(path).set(headers);
}

async function makeThread(
  targetCompanyId: string,
  data: Record<string, unknown> = {},
) {
  phoneN += 1;
  const digits = String(phoneN).padStart(7, "0");
  return db.thread.create({
    data: {
      companyId: targetCompanyId,
      phone: `+5989${digits}`,
      waId: `5989${digits}`,
      name: `Lead ${digits}`,
      lastMessageAt: NOW,
      createdAt: NOW,
      ...data,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  phoneN = 0;
  companyId = (await createCompany(db, { slug: "altamira", name: "Altamira" }))
    .id;
  otherCompanyId = (await createCompany(db, { slug: "otra", name: "Otra" })).id;
  anaId = (
    await db.operator.create({
      data: { email: "ana@altamira.uy", companyId },
    })
  ).id;
  ctx = createTestContext({
    env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
    now: () => NOW,
  });
  app = createApp(ctx);
});

describe("access", () => {
  it("gives an operator their own company and ignores companyId", async () => {
    await makeThread(companyId, {
      createdAt: new Date("2026-11-03T15:00:00.000Z"),
    });
    await makeThread(otherCompanyId, {
      createdAt: new Date("2026-11-03T15:00:00.000Z"),
    });

    const response = await metrics(`${RANGE}&companyId=${otherCompanyId}`, {
      ...asAna,
      "X-Company-Id": otherCompanyId,
    }).expect(200);

    expect(response.body.company).toMatchObject({
      id: companyId,
      name: "Altamira",
      slug: "altamira",
      timezone: "America/Montevideo",
      assistantPaused: false,
    });
    expect(response.body.leads).toBe(1);
    expect(response.body.generatedAt).toBe(NOW.toISOString());
    expect(await db.adminAuditEntry.count()).toBe(0);
  });

  it("refuses the companies comparison to an operator", async () => {
    const response = await request(app)
      .get("/internal/metrics/companies")
      .set(asAna)
      .expect(403);
    expect(response.body.error).toMatchObject({
      code: "forbidden",
      message: "No tienes permiso para administrar empresas.",
    });
  });

  it("lets a platform admin pick a company, or use support access", async () => {
    await makeThread(companyId, {
      createdAt: new Date("2026-11-03T15:00:00.000Z"),
    });
    await makeThread(otherCompanyId, {
      createdAt: new Date("2026-11-03T15:00:00.000Z"),
    });
    await makeThread(otherCompanyId, {
      createdAt: new Date("2026-11-03T16:00:00.000Z"),
    });

    const missing = await metrics(RANGE, admin).expect(400);
    expect(missing.body.error).toEqual({
      code: "bad_request",
      message: "Elige una empresa.",
    });

    const chosen = await metrics(
      `${RANGE}&companyId=${otherCompanyId}`,
      admin,
    ).expect(200);
    expect(chosen.body.company.id).toBe(otherCompanyId);
    expect(chosen.body.leads).toBe(2);

    const support = await metrics(`${RANGE}&companyId=${otherCompanyId}`, {
      ...admin,
      "X-Company-Id": companyId,
    }).expect(200);
    expect(support.body.company.id).toBe(companyId);
    expect(support.body.leads).toBe(1);
    expect(await db.adminAuditEntry.count()).toBe(0);

    const unknown = await metrics(
      `${RANGE}&companyId=does-not-exist`,
      admin,
    ).expect(404);
    expect(unknown.body.error).toMatchObject({
      code: "not_found",
      message: "Empresa no encontrada",
    });

    await db.company.update({
      where: { id: otherCompanyId },
      data: { archivedAt: NOW },
    });
    const archived = await metrics(
      `${RANGE}&companyId=${otherCompanyId}`,
      admin,
    ).expect(200);
    expect(archived.body.company).toMatchObject({
      id: otherCompanyId,
      slug: "otra",
    });
  });

  it("refuses an unknown login and an archived operator", async () => {
    const unknown = await metrics(RANGE, stranger).expect(403);
    expect(unknown.body.error).toMatchObject({
      code: "forbidden",
      message: "Este usuario no tiene acceso al panel",
    });

    await db.operator.update({
      where: { id: anaId },
      data: { archivedAt: NOW },
    });
    const archived = await metrics(RANGE).expect(403);
    expect(archived.body.error.code).toBe("operator_archived");
  });

  it("defaults to the 30 days ending today in the company timezone", async () => {
    const response = await metrics().expect(200);
    expect(response.body.range).toEqual({
      from: "2026-10-11",
      to: "2026-11-09",
      days: 30,
    });
    expect(response.body.leadsPerDay).toHaveLength(30);
    expect(response.body.leadsPerDay[0].date).toBe("2026-10-11");
    expect(response.body.leadsPerDay.at(-1).date).toBe("2026-11-09");
  });
});

describe("cohort, funnel, forms, and assistant quality", () => {
  it("computes the full funnel, form reply rate, autonomy, multimedia, and field completion", async () => {
    const at = (day: string, hour = "15") =>
      new Date(`${day}T${hour}:00:00.000Z`);
    const t1 = await makeThread(companyId, {
      createdAt: at("2026-11-01"),
      stage: "qualifying",
      source: "whatsapp",
      collected: { interest: "2 dormitorios", budget: "  " },
    });
    const t2 = await makeThread(companyId, {
      createdAt: at("2026-11-01", "16"),
      stage: "to_contact",
      source: "form",
      handedOffAt: null,
      collected: { interest: "1 dormitorio", budget: "150k" },
    });
    await makeThread(companyId, {
      createdAt: at("2026-11-02"),
      stage: "qualifying",
      source: "form",
      handedOffAt: at("2026-11-02", "18"),
      paused: true,
      collected: { interest: "Inversión" },
    });
    await makeThread(companyId, {
      createdAt: at("2026-11-02", "16"),
      stage: "not_interested",
      needsHuman: true,
    });
    const t5 = await makeThread(companyId, {
      createdAt: at("2026-11-03"),
      stage: "contacted",
      collected: {
        interest: "3 dormitorios",
        budget: "300k",
        knowsProjects: "Sí",
      },
    });
    await makeThread(companyId, { createdAt: at("2026-10-31") });
    await makeThread(otherCompanyId, { createdAt: at("2026-11-01") });

    // Form lead t2 replied (with audio + image); form lead t3 never replied.
    // Advisor wrote manually in t5 (so t5 is not counted as autonomous).
    await db.message.createMany({
      data: [
        {
          companyId,
          threadId: t2.id,
          direction: "inbound",
          type: "audio",
          body: "",
          sentAt: at("2026-11-01", "17"),
        },
        {
          companyId,
          threadId: t2.id,
          direction: "inbound",
          type: "image",
          body: "",
          sentAt: at("2026-11-01", "18"),
        },
        {
          companyId,
          threadId: t5.id,
          direction: "outbound",
          type: "text",
          body: "Te llamo ahora",
          sentByEmail: "ana@altamira.uy",
          sentAt: at("2026-11-03", "16"),
        },
        {
          companyId,
          threadId: t1.id,
          direction: "outbound",
          type: "text",
          body: "fallo",
          status: "failed",
          sentAt: at("2026-11-02", "12"),
        },
      ],
    });

    const body = (await metrics("from=2026-11-01&to=2026-11-04").expect(200))
      .body;

    expect(body.leads).toBe(5);
    expect(body.leadsBySource).toEqual({ whatsapp: 3, form: 2 });
    expect(body.funnel).toEqual({
      leads: 5,
      qualified: 3,
      qualificationRate: 3 / 5,
      contacted: 1,
      contactedRate: 1 / 3,
      qualifying: 2,
      toContact: 1,
      notInterested: 1,
      notInterestedRate: 1 / 5,
      disqualified: 0,
      noResponse: 0,
    });
    expect(body.forms).toEqual({
      leads: 2,
      replied: 1,
      replyRate: 0.5,
    });
    // Autonomous: t1 and t2 (t3 is paused, t4 needsHuman, t5 had advisor reply).
    expect(body.assistant).toEqual({
      autonomousLeads: 2,
      autonomyRate: 2 / 5,
      nonTextLeads: 1,
      nonTextRate: 1 / 5,
      nonTextMessages: 2,
      failedOutboundMessages: 1,
      fieldCompletion: [
        {
          key: "interest",
          name: "Interés",
          required: true,
          collected: 4,
          rate: 4 / 5,
        },
        {
          key: "budget",
          name: "Presupuesto",
          required: true,
          collected: 2,
          rate: 2 / 5,
        },
        {
          key: "knowsProjects",
          name: "Conoce los proyectos",
          required: true,
          collected: 1,
          rate: 1 / 5,
        },
      ],
    });
    expect(body.leadsPerDay).toEqual([
      {
        date: "2026-11-01",
        qualifying: 1,
        to_contact: 1,
        contacted: 0,
        not_interested: 0,
        disqualified: 0,
        no_response: 0,
      },
      {
        date: "2026-11-02",
        qualifying: 1,
        to_contact: 0,
        contacted: 0,
        not_interested: 1,
        disqualified: 0,
        no_response: 0,
      },
      {
        date: "2026-11-03",
        qualifying: 0,
        to_contact: 0,
        contacted: 1,
        not_interested: 0,
        disqualified: 0,
        no_response: 0,
      },
      {
        date: "2026-11-04",
        qualifying: 0,
        to_contact: 0,
        contacted: 0,
        not_interested: 0,
        disqualified: 0,
        no_response: 0,
      },
    ]);
  });

  it("buckets a lead by the company timezone, not UTC", async () => {
    await makeThread(companyId, {
      createdAt: new Date("2026-11-02T02:00:00.000Z"),
      stage: "qualifying",
    });
    const body = (await metrics("from=2026-11-01&to=2026-11-02").expect(200))
      .body;
    expect(body.leads).toBe(1);
    expect(body.leadsPerDay).toEqual([
      {
        date: "2026-11-01",
        qualifying: 1,
        to_contact: 0,
        contacted: 0,
        not_interested: 0,
        disqualified: 0,
        no_response: 0,
      },
      {
        date: "2026-11-02",
        qualifying: 0,
        to_contact: 0,
        contacted: 0,
        not_interested: 0,
        disqualified: 0,
        no_response: 0,
      },
    ]);
  });

  it("counts Saturday, before 09:00, and 18:00 as out of hours", async () => {
    const local = (iso: string) => new Date(iso);
    // Tuesday 3 Nov and Saturday 7 Nov 2026, America/Montevideo (UTC−3).
    await makeThread(companyId, {
      createdAt: local("2026-11-07T15:00:00.000Z"),
    });
    await makeThread(companyId, {
      createdAt: local("2026-11-03T11:59:00.000Z"),
    });
    await makeThread(companyId, {
      createdAt: local("2026-11-03T21:00:00.000Z"),
    });
    await makeThread(companyId, {
      createdAt: local("2026-11-03T12:00:00.000Z"),
    });
    await makeThread(companyId, {
      createdAt: local("2026-11-03T20:59:00.000Z"),
    });

    const body = (await metrics("from=2026-11-03&to=2026-11-07").expect(200))
      .body;
    expect(body.leads).toBe(5);
    expect(body.outOfHours).toBe(3);
    expect(body.outOfHoursRate).toBe(3 / 5);
  });
});

describe("time to contact and advisors", () => {
  it("uses nearest-rank median and p90, computes per-advisor performance, and drops inverted rows", async () => {
    const luisId = (
      await db.operator.create({
        data: { email: "luis@altamira.uy", companyId },
      })
    ).id;
    await db.operator.create({
      data: { email: "archived@altamira.uy", companyId, archivedAt: NOW },
    });

    const handoff = new Date("2026-11-05T12:00:00.000Z");
    const anaWaits = [10, 20, 30];
    for (const minutes of anaWaits) {
      await makeThread(companyId, {
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        stage: "contacted",
        contactedById: anaId,
        handedOffAt: handoff,
        contactedAt: new Date(handoff.getTime() + minutes * 60_000),
      });
    }
    for (const minutes of [40, 100]) {
      await makeThread(companyId, {
        createdAt: new Date("2026-10-01T12:00:00.000Z"),
        stage: "contacted",
        contactedById: luisId,
        handedOffAt: handoff,
        contactedAt: new Date(handoff.getTime() + minutes * 60_000),
      });
    }
    // Contacted without handoff: still counts in advisor's contactedInRange, excluded from median.
    await makeThread(companyId, {
      createdAt: new Date("2026-10-01T12:00:00.000Z"),
      stage: "contacted",
      contactedById: luisId,
      handedOffAt: null,
      contactedAt: new Date("2026-11-05T15:00:00.000Z"),
    });
    // Inverted and out-of-range rows.
    await makeThread(companyId, {
      createdAt: new Date("2026-10-01T12:00:00.000Z"),
      stage: "contacted",
      handedOffAt: new Date("2026-11-05T18:00:00.000Z"),
      contactedAt: new Date("2026-11-05T17:00:00.000Z"),
    });
    await makeThread(companyId, {
      createdAt: new Date("2026-09-01T12:00:00.000Z"),
      stage: "contacted",
      handedOffAt: new Date("2026-10-01T12:00:00.000Z"),
      contactedAt: new Date("2026-10-02T12:00:00.000Z"),
    });
    // Open assigned threads for snapshot.
    await makeThread(companyId, {
      stage: "to_contact",
      assignedToId: anaId,
      handedOffAt: new Date(NOW.getTime() - 30 * 3_600_000),
    });
    await makeThread(companyId, {
      stage: "to_contact",
      assignedToId: anaId,
      handedOffAt: new Date(NOW.getTime() - 2 * 3_600_000),
    });

    const body = (await metrics("from=2026-11-01&to=2026-11-08").expect(200))
      .body;
    expect(body.timeToContact).toEqual({
      count: 5,
      medianMinutes: 30,
      p90Minutes: 100,
    });
    expect(body.advisors).toEqual([
      {
        operatorId: anaId,
        email: "ana@altamira.uy",
        assigned: 2,
        pendingOver24h: 1,
        contactedInRange: 3,
        medianMinutesToContact: 20,
      },
      {
        operatorId: luisId,
        email: "luis@altamira.uy",
        assigned: 0,
        pendingOver24h: 0,
        contactedInRange: 3,
        medianMinutesToContact: 40,
      },
    ]);
  });
});

describe("snapshots", () => {
  it("keeps the queue independent of the selected range", async () => {
    const hour = 60 * 60 * 1000;
    await makeThread(companyId, {
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      stage: "to_contact",
      assignedToId: null,
      handedOffAt: new Date(NOW.getTime() - 48 * hour),
    });
    await makeThread(companyId, {
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      stage: "to_contact",
      assignedToId: null,
      handedOffAt: new Date(NOW.getTime() - 24 * hour),
    });
    await makeThread(companyId, {
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      stage: "to_contact",
      assignedToId: null,
      handedOffAt: new Date(NOW.getTime() - hour),
    });
    await makeThread(companyId, {
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      stage: "to_contact",
      assignedToId: anaId,
      handedOffAt: new Date(NOW.getTime() - 72 * hour),
    });
    await makeThread(companyId, {
      createdAt: new Date("2026-11-01T12:00:00.000Z"),
      stage: "qualifying",
      assignedToId: null,
    });

    const body = (await metrics("from=2026-01-15&to=2026-01-15").expect(200))
      .body;
    expect(body.leads).toBe(0);
    expect(body.queue).toEqual({
      toContact: 4,
      unassigned: 3,
      unassignedOver24h: 1,
      oldestWaitingMinutes: 48 * 60,
    });
  });

  it("groups a stopped assistant by reason and counts manually paused threads", async () => {
    const reasons = [
      "forbidden_topic: rentabilidad",
      "model_failure: timeout",
      "send_failed: 500",
      "lead_needs_human",
      "empty_reply",
      "channel_unavailable",
      "nope",
      null,
    ];
    for (const needsHumanReason of reasons) {
      await makeThread(companyId, {
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
        needsHuman: true,
        paused: true,
        needsHumanReason,
      });
    }
    await makeThread(companyId, {
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      needsHuman: false,
      paused: true,
      needsHumanReason: null,
    });
    await makeThread(companyId, {
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
      needsHuman: false,
      paused: false,
      needsHumanReason: "forbidden_topic: ignored",
    });

    const body = (await metrics("from=2026-11-01&to=2026-11-08").expect(200))
      .body;
    expect(body.needsHuman).toEqual({
      total: 8,
      pausedManually: 1,
      byReason: {
        forbidden_topic: 1,
        model_failure: 1,
        send_failed: 1,
        lead_needs_human: 1,
        empty_reply: 1,
        channel_unavailable: 1,
        other: 2,
      },
    });
  });

  it("reports knowledge age from the latest upload", async () => {
    const uploaded = new Date(NOW.getTime() - 2.5 * 86_400_000);
    const file = await db.knowledgeFile.create({
      data: {
        companyId,
        name: "Precios.xlsx",
        nameKey: "precios.xlsx",
        format: "xlsx",
        mimeType: "application/vnd.ms-excel",
        sizeBytes: 10,
        sha256: "abc",
        text: "precios",
        charCount: 7,
        createdAt: uploaded,
        updatedAt: uploaded,
      },
    });
    await db.$executeRaw`
      UPDATE "KnowledgeFile" SET "updatedAt" = ${uploaded} WHERE "id" = ${file.id}
    `;

    const body = (await metrics("from=2026-11-01&to=2026-11-08").expect(200))
      .body;
    expect(body.knowledge).toEqual({
      files: 1,
      lastUploadAt: uploaded.toISOString(),
      daysSinceLastUpload: 2,
    });
  });
});

describe("spend", () => {
  it("bills outbound messages that have no delivery status yet", async () => {
    const thread = await makeThread(companyId, {
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
    });
    const sentAt = new Date("2026-11-05T15:00:00.000Z");
    const base = {
      companyId,
      threadId: thread.id,
      direction: "outbound" as const,
      body: "hola",
      sentAt,
    };
    await db.message.createMany({
      data: [
        { ...base, type: "text" },
        { ...base, type: "template" },
      ],
    });

    const body = (await metrics("from=2026-11-01&to=2026-11-30").expect(200))
      .body;
    expect(body.spend.whatsapp).toMatchObject({
      templates: 1,
      serviceMessages: 1,
      currentMonthTotalMessages: 2,
    });
  });

  it("applies the WhatsApp free tier across a partial month and tracks current-month volume", async () => {
    const thread = await makeThread(companyId, {
      createdAt: new Date("2026-01-01T12:00:00.000Z"),
    });
    const earlyNov = new Date("2026-11-02T15:00:00.000Z");
    const midNov = new Date("2026-11-06T15:00:00.000Z");
    const base = {
      companyId,
      threadId: thread.id,
      direction: "outbound" as const,
      type: "text",
      body: "hola",
    };
    await db.message.createMany({
      data: [
        // 998 service messages before the range starts on Nov 5.
        ...Array.from({ length: 998 }, () => ({
          ...base,
          status: "sent",
          sentAt: earlyNov,
        })),
        // 5 service messages inside the range: 2 free, 3 billable.
        ...Array.from({ length: 5 }, () => ({
          ...base,
          status: "sent",
          sentAt: midNov,
        })),
        // Failed message does not count toward billing or current-month Kapso volume.
        { ...base, status: "failed", sentAt: midNov },
        // 1 inbound message in Nov counts toward current-month Kapso volume.
        {
          companyId,
          threadId: thread.id,
          direction: "inbound" as const,
          type: "text",
          body: "hola",
          sentAt: midNov,
        },
        // 2 templates in range.
        ...Array.from({ length: 2 }, () => ({
          ...base,
          type: "template",
          status: "sent",
          sentAt: midNov,
        })),
      ],
    });

    const body = (await metrics("from=2026-11-05&to=2026-11-09").expect(200))
      .body;
    const whatsappUsd = 2 * WHATSAPP_TEMPLATE_USD + 3 * WHATSAPP_SERVICE_USD;
    expect(body.spend.whatsapp).toEqual({
      usd: whatsappUsd,
      templates: 2,
      serviceMessages: 5,
      freeServiceMessages: 2,
      billableServiceMessages: 3,
      currentMonthTotalMessages: 998 + 5 + 1 + 2,
    });
    expect(body.spend.totalUsd).toBe(Math.round(whatsappUsd * 100) / 100);
    // 5 elapsed days (Nov 5..9): projected to 30 days.
    expect(body.spend.projectedMonthlyUsd).toBe(
      Math.round((whatsappUsd / 5) * 30 * 100) / 100,
    );
  });

  it("splits real Anthropic usage from Probar asistente, excludes tests from perLeadUsd, and suppresses <3-day projections", async () => {
    const inRange = new Date("2026-11-08T15:00:00.000Z");
    const thread = await makeThread(companyId, { createdAt: inRange });
    // Real conversation turn ($1 input + $10 output = $11).
    await db.llmUsage.create({
      data: {
        companyId,
        threadId: thread.id,
        model: "claude-haiku-4-5",
        inputTokens: 1_000_000,
        outputTokens: 2_000_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        latencyMs: 20,
        createdAt: inRange,
      },
    });
    // Probar asistente turn (threadId: null, $5 output).
    await db.llmUsage.create({
      data: {
        companyId,
        threadId: null,
        model: "claude-haiku-4-5",
        inputTokens: 0,
        outputTokens: 1_000_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        latencyMs: 20,
        createdAt: inRange,
      },
    });
    await db.llmUsage.create({
      data: {
        companyId,
        threadId: null,
        model: "claude-mystery",
        inputTokens: 500,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        latencyMs: 20,
        createdAt: inRange,
      },
    });

    // 2-day range: projectedMonthlyUsd must be null (< 3 elapsed days).
    const shortRange = (
      await metrics("from=2026-11-08&to=2026-11-09").expect(200)
    ).body;
    expect(shortRange.spend.anthropic.realUsd).toBe(11);
    expect(shortRange.spend.anthropic.testUsd).toBe(5);
    expect(shortRange.spend.anthropic.usd).toBe(16);
    expect(shortRange.spend.anthropic.realCalls).toBe(1);
    expect(shortRange.spend.anthropic.testCalls).toBe(2);
    expect(shortRange.spend.anthropic.calls).toBe(3);
    expect(shortRange.spend.anthropic.unpricedModels).toEqual([
      "claude-mystery",
    ]);
    expect(shortRange.spend.totalUsd).toBe(16);
    expect(shortRange.spend.perLeadUsd).toBe(11);
    expect(shortRange.spend.anthropicPerLeadUsd).toBe(11);
    expect(shortRange.spend.projectedMonthlyUsd).toBeNull();
  });

  it("hides HubSpot counts while the integration is off", async () => {
    await db.company.update({
      where: { id: companyId },
      data: { hubspotEnabled: false },
    });
    await makeThread(companyId, {
      crmPendingAction: "update",
      crmLastError: "timeout",
    });
    await makeThread(companyId, {
      crmPendingAction: "handoff",
      crmLastError: null,
    });

    const off = (await metrics(RANGE).expect(200)).body;
    expect(off.hubspot).toEqual({ enabled: false, pending: 0, failing: 0 });

    await db.company.update({
      where: { id: companyId },
      data: { hubspotEnabled: true },
    });
    const on = (await metrics(RANGE).expect(200)).body;
    expect(on.hubspot).toEqual({ enabled: true, pending: 2, failing: 1 });
  });
});

describe("companies comparison", () => {
  it("lists active companies by leads with contactedRate, issuesCount, assistantPaused, and anthropicUsd", async () => {
    const onTuesday = new Date("2026-11-03T13:00:00.000Z");
    const alpha = await createCompany(db, { slug: "alpha", name: "Alpha" });
    const beta = await createCompany(db, { slug: "beta", name: "Beta" });
    const gamma = await createCompany(db, { slug: "gamma", name: "Gamma" });
    const archived = await createCompany(db, {
      slug: "archivada",
      name: "Archivada",
    });
    await db.company.update({
      where: { id: gamma.id },
      data: { assistantPaused: true, hubspotEnabled: true },
    });
    await db.company.update({
      where: { id: archived.id },
      data: { archivedAt: NOW },
    });

    for (let i = 0; i < 2; i += 1) {
      await makeThread(alpha.id, { createdAt: onTuesday, stage: "qualifying" });
      await makeThread(beta.id, { createdAt: onTuesday, stage: "qualifying" });
    }
    for (let i = 0; i < 2; i += 1) {
      await makeThread(gamma.id, { createdAt: onTuesday, stage: "qualifying" });
    }
    const gammaOpen = await makeThread(gamma.id, {
      createdAt: onTuesday,
      stage: "to_contact",
      assignedToId: null,
      handedOffAt: onTuesday,
      crmPendingAction: "update",
      crmLastError: "502",
    });
    await makeThread(gamma.id, {
      createdAt: onTuesday,
      stage: "contacted",
      handedOffAt: onTuesday,
      contactedAt: onTuesday,
    });
    await makeThread(gamma.id, {
      createdAt: onTuesday,
      stage: "not_interested",
    });
    await db.message.create({
      data: {
        companyId: gamma.id,
        threadId: gammaOpen.id,
        direction: "outbound",
        type: "text",
        body: "fallo",
        status: "failed",
        sentAt: onTuesday,
      },
    });
    await db.llmUsage.create({
      data: {
        companyId: gamma.id,
        threadId: gammaOpen.id,
        model: "claude-haiku-4-5",
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        latencyMs: 10,
        createdAt: onTuesday,
      },
    });
    for (let i = 0; i < 9; i += 1) {
      await makeThread(archived.id, {
        createdAt: onTuesday,
        stage: "qualifying",
      });
    }

    const query = "from=2026-11-01&to=2026-11-09";
    const active = (
      await request(app)
        .get(`/internal/metrics/companies?${query}`)
        .set(admin)
        .expect(200)
    ).body;
    expect(active.range).toEqual({ from: "2026-11-01", to: "2026-11-09" });
    expect(
      active.rows.map((row: { company: { name: string } }) => row.company.name),
    ).toEqual(["Gamma", "Alpha", "Beta", "Altamira", "Otra"]);
    expect(active.rows[0]).toMatchObject({
      company: {
        name: "Gamma",
        slug: "gamma",
        archived: false,
        assistantPaused: true,
      },
      leads: 5,
      qualificationRate: 2 / 5,
      contactedRate: 1 / 2,
      medianMinutesToContact: 0,
      unassignedToContact: 1,
      needsHuman: 0,
      issuesCount: 2,
      daysSinceLastUpload: null,
      spendUsd: 1,
      anthropicUsd: 1,
    });
    expect(active.rows[1]).toMatchObject({ leads: 2, qualificationRate: 0 });
    expect(active.rows[2]).toMatchObject({
      company: { name: "Beta" },
      leads: 2,
    });

    const all = (
      await request(app)
        .get(`/internal/metrics/companies?${query}&status=all`)
        .set(admin)
        .expect(200)
    ).body;
    expect(
      all.rows.map(
        (row: { company: { name: string }; leads: number }) =>
          [row.company.name, row.leads] as const,
      ),
    ).toEqual([
      ["Archivada", 9],
      ["Gamma", 5],
      ["Alpha", 2],
      ["Beta", 2],
      ["Altamira", 0],
      ["Otra", 0],
    ]);
    expect(all.rows[0].company.archived).toBe(true);
  });
});

describe("validation", () => {
  it("rejects a bad date, an inverted range, and more than 366 days", async () => {
    for (const query of ["from=2026-02-31", "from=ayer", "from=2026-13-01"]) {
      const response = await metrics(query).expect(400);
      expect(response.body.error.code).toBe("bad_request");
    }
    const inverted = await metrics("from=2026-11-10&to=2026-11-01").expect(400);
    expect(inverted.body.error.code).toBe("bad_request");
    const tooLong = await metrics("from=2026-01-01&to=2027-01-02").expect(400);
    expect(tooLong.body.error.code).toBe("bad_request");

    const exact = await metrics("from=2026-01-01&to=2027-01-01").expect(200);
    expect(exact.body.range).toEqual({
      from: "2026-01-01",
      to: "2027-01-01",
      days: 366,
    });
    expect(exact.body.leadsPerDay).toHaveLength(366);

    const companies = await request(app)
      .get("/internal/metrics/companies?from=no")
      .set(admin)
      .expect(400);
    expect(companies.body.error.code).toBe("bad_request");
  });
});
