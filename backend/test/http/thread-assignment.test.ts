import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

const db = testDb();
let app: ReturnType<typeof createApp>;
let companyId: string;
let otherCompanyId: string;
let ana: string;
let bruno: string;
let archivedOperator: string;
let otherCompanyOperator: string;

const asAna = { Authorization: "Bearer dev:ana@altamira.uy" };
const asBruno = { Authorization: "Bearer dev:bruno@altamira.uy" };
const admin = { Authorization: "Bearer dev:admin@example.com" };

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

async function makeThread(phone: string, data: Record<string, unknown> = {}) {
  return db.thread.create({
    data: {
      companyId,
      phone,
      waId: phone.slice(1),
      name: `Lead ${phone.slice(-3)}`,
      lastMessageAt: new Date(),
      ...data,
    },
  });
}

const handedOff = (minutes: number) => ({
  state: "handoff" as const,
  stage: "to_contact" as const,
  handedOffAt: minutesAgo(minutes),
  lastInboundAt: minutesAgo(minutes),
});

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
  archivedOperator = (
    await db.operator.create({
      data: { email: "ex@altamira.uy", companyId, archivedAt: new Date() },
    })
  ).id;
  otherCompanyOperator = (
    await db.operator.create({
      data: { email: "operador@otra.uy", companyId: otherCompanyId },
    })
  ).id;
  app = createApp(
    createTestContext({ env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" } }),
  );
});

describe("the Por contactar queue", () => {
  it("lists oldest handoff first, with the wait, the assignee, and whether the lead wrote again", async () => {
    await makeThread("+59899000001", handedOff(5));
    const oldest = await makeThread("+59899000002", {
      ...handedOff(90),
      lastInboundAt: minutesAgo(10),
      assignedToId: bruno,
      assignedAt: minutesAgo(60),
    });
    await makeThread("+59899000003", { state: "qualify" });

    const response = await request(app)
      .get("/internal/threads?stage=to_contact")
      .set(asAna)
      .expect(200);
    expect(
      response.body.threads.map((thread: { phone: string }) => thread.phone),
    ).toEqual(["+59899000002", "+59899000001"]);
    expect(response.body.threads[0]).toMatchObject({
      id: oldest.id,
      stage: "to_contact",
      botActivity: "active",
      handedOffAt: expect.any(String),
      wroteAgain: true,
      assignee: { id: bruno, email: "bruno@altamira.uy", archived: false },
    });
    expect(response.body.threads[1]).toMatchObject({
      wroteAgain: false,
      assignee: null,
    });
  });

  it("filters to the threads assigned to me", async () => {
    await makeThread("+59899000001", { ...handedOff(5), assignedToId: ana });
    await makeThread("+59899000002", { ...handedOff(9), assignedToId: bruno });
    await makeThread("+59899000003", { stage: "contacted", assignedToId: ana });

    const mine = await request(app)
      .get("/internal/threads?assignee=me")
      .set(asAna)
      .expect(200);
    expect(
      mine.body.threads.map((thread: { phone: string }) => thread.phone).sort(),
    ).toEqual(["+59899000001", "+59899000003"]);
    const summary = await request(app)
      .get("/internal/threads/summary")
      .set(asAna)
      .expect(200);
    expect(summary.body.mine).toEqual({ all: 2, toContact: 1 });
    expect(summary.body.unassignedToContact).toBe(0);

    await request(app)
      .get("/internal/threads?assignee=me")
      .set(admin)
      .set({ "X-Company-Id": companyId })
      .expect(400);
  });
});

describe("assignment", () => {
  it("Tomar gives the thread to me, and another operator can take it over", async () => {
    const thread = await makeThread("+59899000001", handedOff(5));
    const taken = await request(app)
      .post(`/internal/threads/${thread.id}/take`)
      .set(asAna)
      .expect(200);
    expect(taken.body.thread.assignee).toMatchObject({ id: ana });
    expect(taken.body.thread.assignedAt).not.toBeNull();

    const takenOver = await request(app)
      .post(`/internal/threads/${thread.id}/take`)
      .set(asBruno)
      .expect(200);
    expect(takenOver.body.thread.assignee).toMatchObject({ id: bruno });
  });

  it("assigns to another active operator of the same company, reassigns, and unassigns", async () => {
    const thread = await makeThread("+59899000001", handedOff(5));
    const assigned = await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(asAna)
      .send({ operatorId: bruno })
      .expect(200);
    expect(assigned.body.thread.assignee).toMatchObject({
      id: bruno,
      email: "bruno@altamira.uy",
    });

    await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(asAna)
      .send({ operatorId: ana })
      .expect(200);
    const unassigned = await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(asAna)
      .send({ operatorId: null })
      .expect(200);
    expect(unassigned.body.thread).toMatchObject({
      assignee: null,
      assignedAt: null,
    });
  });

  it("never assigns to an operator of another company", async () => {
    const thread = await makeThread("+59899000001", handedOff(5));
    await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(asAna)
      .send({ operatorId: otherCompanyOperator })
      .expect(404);
    const theirs = await db.thread.create({
      data: {
        companyId: otherCompanyId,
        phone: "+59899000009",
        waId: "59899000009",
      },
    });
    await request(app)
      .post(`/internal/threads/${theirs.id}/assign`)
      .set(asAna)
      .send({ operatorId: ana })
      .expect(404);
    await request(app)
      .post(`/internal/threads/${theirs.id}/take`)
      .set(asAna)
      .expect(404);
    expect(
      (await db.thread.findMany({ where: { assignedToId: { not: null } } }))
        .length,
    ).toBe(0);
  });

  it("does not assign to an archived operator, and lists only active ones", async () => {
    const thread = await makeThread("+59899000001", handedOff(5));
    const refused = await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(asAna)
      .send({ operatorId: archivedOperator })
      .expect(400);
    expect(refused.body.error.code).toBe("assignee_archived");

    const assignees = await request(app)
      .get("/internal/threads/assignees")
      .set(asAna)
      .expect(200);
    expect(assignees.body.assignees).toEqual([
      { id: ana, email: "ana@altamira.uy", me: true },
      { id: bruno, email: "bruno@altamira.uy", me: false },
    ]);
  });

  it("rejects a body that is not just the operator id", async () => {
    const thread = await makeThread("+59899000001");
    await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(asAna)
      .send({ operatorId: bruno, companyId: otherCompanyId })
      .expect(400);
    await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(asAna)
      .send({})
      .expect(400);
  });
});

describe("Marcar contactado", () => {
  it("records who and when, and assigns the thread to me when nobody had it", async () => {
    const thread = await makeThread("+59899000001", handedOff(30));
    const response = await request(app)
      .post(`/internal/threads/${thread.id}/contacted`)
      .set(asAna)
      .expect(200);
    expect(response.body.thread).toMatchObject({
      stage: "contacted",
      contactedBy: "ana@altamira.uy",
      assignee: { id: ana },
      wroteAgain: false,
    });
    const saved = await db.thread.findUniqueOrThrow({
      where: { id: thread.id },
    });
    expect(saved.contactedById).toBe(ana);
    expect(saved.contactedAt).not.toBeNull();

    await request(app)
      .post(`/internal/threads/${thread.id}/contacted`)
      .set(asAna)
      .expect(409);
  });

  it("keeps the assignee when someone else had it", async () => {
    const thread = await makeThread("+59899000001", {
      ...handedOff(30),
      assignedToId: bruno,
    });
    const response = await request(app)
      .post(`/internal/threads/${thread.id}/contacted`)
      .set(asAna)
      .expect(200);
    expect(response.body.thread).toMatchObject({
      contactedBy: "ana@altamira.uy",
      assignee: { id: bruno },
    });
  });

  it("shows that the lead wrote after being contacted", async () => {
    const thread = await makeThread("+59899000001", {
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

describe("through support access", () => {
  const enter = () => ({ "X-Company-Id": companyId });

  it("cannot Tomar, but assigns and marks contacted, and every write is audited", async () => {
    const thread = await makeThread("+59899000001", handedOff(30));
    const refused = await request(app)
      .post(`/internal/threads/${thread.id}/take`)
      .set(admin)
      .set(enter())
      .expect(400);
    expect(refused.body.error.code).toBe("no_operator");

    await request(app)
      .post(`/internal/threads/${thread.id}/assign`)
      .set(admin)
      .set(enter())
      .send({ operatorId: bruno })
      .expect(200);
    const contacted = await request(app)
      .post(`/internal/threads/${thread.id}/contacted`)
      .set(admin)
      .set(enter())
      .expect(200);
    expect(contacted.body.thread).toMatchObject({
      contactedBy: "admin@example.com",
      assignee: { id: bruno },
    });
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: thread.id } }))
        .contactedById,
    ).toBeNull();

    const audit = await db.adminAuditEntry.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(audit.map((entry) => entry.action)).toEqual([
      `POST /internal/threads/${thread.id}/take`,
      `POST /internal/threads/${thread.id}/assign`,
      `POST /internal/threads/${thread.id}/contacted`,
    ]);
    expect(
      audit.every((entry) => entry.adminEmail === "admin@example.com"),
    ).toBe(true);
  });
});
