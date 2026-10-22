import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
  type TestContext,
} from "../support/harness.js";

const db = testDb();
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;
let otherCompanyId: string;
let ana: string;
let bruno: string;

const asAna = { Authorization: "Bearer dev:ana@altamira.uy" };
const asBruno = { Authorization: "Bearer dev:bruno@altamira.uy" };
const admin = { Authorization: "Bearer dev:admin@example.com" };

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const qualified = {
  interest: "2 dormitorios",
  budget: "USD 150.000",
  knowsProjects: "No",
};

async function makeThread(data: Record<string, unknown> = {}) {
  return db.thread.create({
    data: {
      companyId,
      phone: "+59899000001",
      waId: "59899000001",
      name: "Lead 001",
      lastMessageAt: new Date(),
      ...data,
    },
  });
}

const handedOff = (minutes: number) => ({
  state: "answer" as const,
  stage: "to_contact" as const,
  collected: qualified,
  callTime: "mañana a las 10",
  handedOffAt: minutesAgo(minutes),
  lastInboundAt: minutesAgo(minutes),
});

function setStage(
  threadId: string,
  stage: string,
  as: Record<string, string> = asAna,
) {
  return request(app)
    .post(`/internal/threads/${threadId}/stage`)
    .set(as)
    .send({ stage });
}

const saved = (id: string) => db.thread.findUniqueOrThrow({ where: { id } });

beforeEach(async () => {
  await resetDb();
  companyId = (await createCompany(db, { slug: "altamira" })).id;
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
    data: { email: "operador@otra.uy", companyId: otherCompanyId },
  });
  ctx = createTestContext({
    env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
  });
  app = createApp(ctx);
});

describe("changing the stage by hand", () => {
  it("moves a thread to any stage, in any direction, and records who and when", async () => {
    const thread = await makeThread({
      state: "qualify",
      collected: { interest: "2 dormitorios" },
    });
    const path: Array<[string, string]> = [
      ["contacted", "qualify"],
      ["qualifying", "qualify"],
      ["not_interested", "closed"],
      ["to_contact", "answer"],
      ["qualifying", "qualify"],
    ];
    for (const [stage, state] of path) {
      const response = await setStage(thread.id, stage).expect(200);
      expect(response.body.thread).toMatchObject({
        stage,
        state,
        stageChange: { at: expect.any(String), by: "ana@altamira.uy" },
      });
    }
    const changes = await db.leadStageChange.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: "asc" },
    });
    expect(changes.map((change) => [change.fromStage, change.toStage])).toEqual(
      [
        ["qualifying", "contacted"],
        ["contacted", "qualifying"],
        ["qualifying", "not_interested"],
        ["not_interested", "to_contact"],
        ["to_contact", "qualifying"],
      ],
    );
    expect(
      changes.every(
        (change) =>
          change.changedById === ana &&
          change.changedByEmail === "ana@altamira.uy" &&
          !change.support,
      ),
    ).toBe(true);
    expect((await saved(thread.id)).stageChangedById).toBe(ana);
  });

  it("picking the stage the thread already has changes nothing", async () => {
    const thread = await makeThread(handedOff(30));
    const response = await setStage(thread.id, "to_contact").expect(200);
    expect(response.body.thread.stageChange).toBeNull();
    expect(await db.leadStageChange.count()).toBe(0);
    expect((await saved(thread.id)).crmPendingAction).toBeNull();
  });

  it("puts a lead moved to Por contactar at the end of the queue, and keeps its place when Contactado is undone", async () => {
    const qualifying = await makeThread({ state: "qualify" });
    await setStage(qualifying.id, "to_contact").expect(200);
    const queued = await saved(qualifying.id);
    expect(queued.handedOffAt).toEqual(queued.stageChangedAt);

    await setStage(qualifying.id, "qualifying").expect(200);
    expect((await saved(qualifying.id)).handedOffAt).toBeNull();

    await db.thread.delete({ where: { id: qualifying.id } });
    const waiting = await makeThread(handedOff(90));
    await setStage(waiting.id, "contacted").expect(200);
    await setStage(waiting.id, "to_contact").expect(200);
    expect((await saved(waiting.id)).handedOffAt).toEqual(waiting.handedOffAt);
  });

  it("rejects an unknown stage or extra fields", async () => {
    const thread = await makeThread();
    await setStage(thread.id, "closed").expect(400);
    await request(app)
      .post(`/internal/threads/${thread.id}/stage`)
      .set(asAna)
      .send({ stage: "contacted", contactedBy: "otro@altamira.uy" })
      .expect(400);
    expect((await saved(thread.id)).stage).toBe("qualifying");
  });
});

describe("Contactado", () => {
  it("records who and when, and assigns the thread to me when nobody had it", async () => {
    const thread = await makeThread(handedOff(30));
    const response = await setStage(thread.id, "contacted").expect(200);
    expect(response.body.thread).toMatchObject({
      stage: "contacted",
      contactedBy: "ana@altamira.uy",
      contactedAt: expect.any(String),
      assignee: { id: ana },
      wroteAgain: false,
    });
    const row = await saved(thread.id);
    expect(row.contactedById).toBe(ana);
    expect(row.handedOffAt).toEqual(thread.handedOffAt);
  });

  it("keeps the assignee when someone else had it", async () => {
    const thread = await makeThread({ ...handedOff(30), assignedToId: bruno });
    const response = await setStage(thread.id, "contacted").expect(200);
    expect(response.body.thread).toMatchObject({
      contactedBy: "ana@altamira.uy",
      assignee: { id: bruno },
    });
  });

  it("clears who and when on leaving Contactado, and records them again on coming back", async () => {
    const thread = await makeThread(handedOff(30));
    await setStage(thread.id, "contacted").expect(200);
    const undone = await setStage(thread.id, "to_contact", asBruno).expect(200);
    expect(undone.body.thread).toMatchObject({
      stage: "to_contact",
      contactedAt: null,
      contactedBy: null,
      assignee: { id: ana },
      stageChange: { by: "bruno@altamira.uy" },
    });
    expect((await saved(thread.id)).contactedById).toBeNull();

    const again = await setStage(thread.id, "contacted", asBruno).expect(200);
    expect(again.body.thread).toMatchObject({
      contactedBy: "bruno@altamira.uy",
      assignee: { id: ana },
    });
    expect((await saved(thread.id)).contactedById).toBe(bruno);
  });

  it("shows that the lead wrote after being contacted", async () => {
    const thread = await makeThread({
      ...handedOff(30),
      stage: "contacted",
      contactedAt: minutesAgo(20),
      lastInboundAt: minutesAgo(1),
    });
    const response = await request(app)
      .get(`/internal/threads/${thread.id}`)
      .set(asAna)
      .expect(200);
    expect(response.body.thread.wroteAgain).toBe(true);
  });
});

describe("HubSpot", () => {
  it("rewrites the contact's property with the new stage and who picked it", async () => {
    const thread = await makeThread({
      ...handedOff(30),
      crmContactId: "fake-contact-1",
      crmSyncedAt: minutesAgo(30),
    });
    await setStage(thread.id, "contacted").expect(200);
    await ctx.crm.drain();
    const summary =
      ctx.integrations.fakes.crm.contacts.get("+59899000001")?.lead.summary;
    expect(summary).toContain("Estado: Contactado por un asesor");
    expect(summary).toMatch(
      /Etapa: Contactado \(la eligió ana@altamira\.uy el /,
    );

    await setStage(thread.id, "not_interested").expect(200);
    await ctx.crm.drain();
    expect(
      ctx.integrations.fakes.crm.contacts.get("+59899000001")?.lead.summary,
    ).toContain("Estado: Cerrado: sin interés\nEtapa: Sin interés");
    expect((await saved(thread.id)).crmPendingAction).toBeNull();
  });
});

describe("company scoping", () => {
  it("never changes another company's thread", async () => {
    const theirs = await db.thread.create({
      data: {
        companyId: otherCompanyId,
        phone: "+59899000009",
        waId: "59899000009",
      },
    });
    await setStage(theirs.id, "contacted").expect(404);
    const row = await saved(theirs.id);
    expect(row).toMatchObject({ stage: "qualifying", contactedAt: null });
    expect(await db.leadStageChange.count()).toBe(0);
  });

  it("through support access, records the admin's email, and every change is audited", async () => {
    const thread = await makeThread(handedOff(30));
    const enter = { "X-Company-Id": companyId };
    const contacted = await setStage(thread.id, "contacted", {
      ...admin,
      ...enter,
    }).expect(200);
    expect(contacted.body.thread).toMatchObject({
      contactedBy: "admin@example.com",
      assignee: null,
      stageChange: { by: "admin@example.com" },
    });
    await setStage(thread.id, "to_contact", { ...admin, ...enter }).expect(200);
    const row = await saved(thread.id);
    expect(row).toMatchObject({ contactedById: null, stageChangedById: null });

    const changes = await db.leadStageChange.findMany();
    expect(
      changes.every(
        (change) =>
          change.support &&
          change.changedById === null &&
          change.changedByEmail === "admin@example.com",
      ),
    ).toBe(true);
    const audit = await db.adminAuditEntry.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((entry) => entry.action)).toEqual([
      `POST /internal/threads/${thread.id}/stage`,
      `POST /internal/threads/${thread.id}/stage`,
    ]);
  });
});
