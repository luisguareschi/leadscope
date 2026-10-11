import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createCompany, createTestContext, resetDb, testDb } from "../support/harness.js";

const db = testDb();
let app: ReturnType<typeof createApp>;
let companyId: string;
let otherCompanyId: string;
const auth = { Authorization: "Bearer dev:operador@test.com" };

async function makeThread(company: string, phone: string, data: Record<string, unknown> = {}) {
  return db.thread.create({
    data: { companyId: company, phone, waId: phone.slice(1), lastMessageAt: new Date(), ...data },
  });
}

beforeEach(async () => {
  await resetDb();
  companyId = (await createCompany(db, { slug: "altamira" })).id;
  otherCompanyId = (await createCompany(db, { slug: "otra" })).id;
  await db.operator.create({ data: { email: "operador@test.com", companyId } });
  app = createApp(createTestContext());
});

describe("backoffice auth", () => {
  it("requires a login", async () => {
    await request(app).get("/internal/threads").expect(401);
    await request(app).get("/internal/threads").set({ Authorization: "Bearer nope" }).expect(403);
    await request(app).get("/internal/threads").set({ Authorization: "Bearer dev:unknown@test.com" }).expect(403);
  });

  it("tells the panel who is signed in", async () => {
    const response = await request(app).get("/internal/me").set(auth).expect(200);
    expect(response.body).toEqual({ operator: { email: "operador@test.com" }, company: { name: "altamira", slug: "altamira" } });
  });
});

describe("threads", () => {
  it("lists only the operator's company, newest activity first", async () => {
    await makeThread(companyId, "+59899000001", { lastMessageAt: new Date(Date.now() - 60_000) });
    await makeThread(companyId, "+59899000002");
    await makeThread(otherCompanyId, "+59899000003");
    const response = await request(app).get("/internal/threads").set(auth).expect(200);
    expect(response.body.threads.map((thread: { phone: string }) => thread.phone)).toEqual(["+59899000002", "+59899000001"]);
    expect(response.body.nextCursor).toBeNull();
  });

  it("filters by status, with counts that add up to the total", async () => {
    await makeThread(companyId, "+59899000001", { state: "qualify" });
    await makeThread(companyId, "+59899000002", { state: "handoff" });
    await makeThread(companyId, "+59899000003", { state: "handoff", needsHuman: true });
    await makeThread(companyId, "+59899000004", { state: "answer", paused: true });
    await makeThread(companyId, "+59899000005", { state: "closed" });

    const summary = await request(app).get("/internal/threads/summary").set(auth).expect(200);
    expect(summary.body).toEqual({ total: 5, active: 1, handoff: 1, needs_human: 1, paused: 1, closed: 1 });

    const handoff = await request(app).get("/internal/threads?status=handoff").set(auth).expect(200);
    expect(handoff.body.threads.map((thread: { phone: string }) => thread.phone)).toEqual(["+59899000002"]);
  });

  it("searches by name or phone digits", async () => {
    await makeThread(companyId, "+59899000001", { name: "Martina" });
    await makeThread(companyId, "+59899777002", { name: "Diego" });
    const byName = await request(app).get("/internal/threads?search=mart").set(auth).expect(200);
    expect(byName.body.threads).toHaveLength(1);
    const byPhone = await request(app).get("/internal/threads?search=099 777").set(auth).expect(200);
    expect(byPhone.body.threads.map((thread: { name: string }) => thread.name)).toEqual(["Diego"]);
  });

  it("pages with a cursor", async () => {
    for (let index = 0; index < 3; index += 1) {
      await makeThread(companyId, `+5989900000${index}`, { lastMessageAt: new Date(Date.now() - index * 1000) });
    }
    const first = await request(app).get("/internal/threads?limit=2").set(auth).expect(200);
    expect(first.body.threads).toHaveLength(2);
    const second = await request(app).get(`/internal/threads?limit=2&cursor=${first.body.nextCursor}`).set(auth).expect(200);
    expect(second.body.threads.map((thread: { phone: string }) => thread.phone)).toEqual(["+59899000002"]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("returns a thread with its messages, but never another company's", async () => {
    const mine = await makeThread(companyId, "+59899000001");
    await db.message.create({
      data: { companyId, threadId: mine.id, direction: "inbound", type: "text", body: "Hola" },
    });
    const theirs = await makeThread(otherCompanyId, "+59899000002");

    const response = await request(app).get(`/internal/threads/${mine.id}`).set(auth).expect(200);
    expect(response.body.messages).toMatchObject([{ direction: "inbound", body: "Hola" }]);
    expect(response.body.thread.crm.status).toBe("none");

    await request(app).get(`/internal/threads/${theirs.id}`).set(auth).expect(404);
    await request(app).post(`/internal/threads/${theirs.id}/pause`).set(auth).expect(404);
    await request(app).delete(`/internal/threads/${theirs.id}`).set(auth).expect(404);
    expect(await db.thread.count({ where: { id: theirs.id } })).toBe(1);
  });

  it("pauses and resumes the bot", async () => {
    const thread = await makeThread(companyId, "+59899000001", { state: "answer" });
    await db.message.create({
      data: { companyId, threadId: thread.id, direction: "inbound", type: "text", body: "Hola" },
    });
    const paused = await request(app).post(`/internal/threads/${thread.id}/pause`).set(auth).expect(200);
    expect(paused.body.thread).toMatchObject({ paused: true, state: "answer" });
    expect(await db.message.count({ where: { handledAt: null } })).toBe(0);

    const resumed = await request(app).post(`/internal/threads/${thread.id}/resume`).set(auth).expect(200);
    expect(resumed.body.thread).toMatchObject({ paused: false, pausedAt: null, state: "answer" });
  });

  it("clears the needs-human flag", async () => {
    const thread = await makeThread(companyId, "+59899000001", { needsHuman: true, needsHumanReason: "lead_needs_human" });
    const response = await request(app).post(`/internal/threads/${thread.id}/clear-needs-human`).set(auth).expect(200);
    expect(response.body.thread).toMatchObject({ needsHuman: false, needsHumanReason: null });
  });

  it("retries a failed CRM write on demand", async () => {
    const thread = await makeThread(companyId, "+59899000001", {
      state: "closed",
      crmPendingAction: "close",
      crmAttempts: 12,
      crmLastError: "HubSpot returned 503",
    });
    const before = await request(app).get(`/internal/threads/${thread.id}`).set(auth).expect(200);
    expect(before.body.thread.crm).toMatchObject({ status: "failed", retriesExhausted: true });

    const response = await request(app).post(`/internal/threads/${thread.id}/crm-sync`).set(auth).expect(200);
    expect(response.body.thread.crm).toMatchObject({ status: "synced", contactId: "fake-contact-1", lastError: null });
    await request(app).post(`/internal/threads/${thread.id}/crm-sync`).set(auth).expect(400);
  });

  it("deletes a lead's thread and messages on request", async () => {
    const thread = await makeThread(companyId, "+59899000001");
    await db.message.create({ data: { companyId, threadId: thread.id, direction: "inbound", type: "text", body: "x" } });
    await request(app).delete(`/internal/threads/${thread.id}`).set(auth).expect(204);
    expect(await db.thread.count()).toBe(0);
    expect(await db.message.count()).toBe(0);
  });

  it("rejects bad input", async () => {
    await request(app).get("/internal/threads?status=bogus").set(auth).expect(400);
    await request(app).get("/internal/threads?limit=500").set(auth).expect(400);
  });
});
