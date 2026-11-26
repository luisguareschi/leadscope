import { SignJWT } from "jose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";
import { fakeSupabase, SUPABASE_URL } from "../support/fake-supabase.js";

const db = testDb();
let app: ReturnType<typeof createApp>;
let supabase: ReturnType<typeof fakeSupabase>;
let bravoId: string;
let altamiraId: string;
let costaId: string;

const ana = { Authorization: "Bearer dev:ana@example.com" };
const admin = { Authorization: "Bearer dev:admin@example.com" };
const inCompany = (companyId: string) => ({ "X-Company-Id": companyId });
const operatorsOf = (companyId: string) =>
  `/internal/companies/${companyId}/operators`;

function makeApp(env: Record<string, string> = {}) {
  return createApp(
    createTestContext({
      env: { PLATFORM_ADMIN_EMAILS: "admin@example.com", ...env },
      authAdmin: supabase.authAdmin,
    }),
  );
}

let joined = 0;

/** Each call joins a minute after the previous one, so the oldest membership is predictable. */
async function addOperator(companyId: string, email: string) {
  joined += 1;
  return db.operator.create({
    data: {
      companyId,
      email,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, joined)),
    },
  });
}

let phones = 0;

async function makeThread(companyId: string, name: string) {
  phones += 1;
  return db.thread.create({
    data: {
      companyId,
      phone: `+5989900${String(phones).padStart(4, "0")}`,
      waId: `5989900${String(phones).padStart(4, "0")}`,
      name,
      state: "answer",
      lastMessageAt: new Date(),
    },
  });
}

async function instructionsOf(companyId: string) {
  return (await db.company.findUniqueOrThrow({ where: { id: companyId } }))
    .instructions;
}

async function waitForAudit() {
  await vi.waitFor(async () => {
    expect(await db.adminAuditEntry.count({ where: { status: null } })).toBe(0);
  });
}

beforeEach(async () => {
  await resetDb();
  // Created in this order so the oldest membership (Bravo) is not the first by name (Altamira).
  bravoId = (await createCompany(db, { slug: "bravo", name: "Bravo" })).id;
  altamiraId = (await createCompany(db, { slug: "altamira", name: "Altamira" }))
    .id;
  costaId = (await createCompany(db, { slug: "costa", name: "Costa" })).id;
  supabase = fakeSupabase();
  app = makeApp();
});

describe("adding one email to several companies", () => {
  it("links the login it already has, with no new email, and still refuses a duplicate in the same company", async () => {
    const first = await request(app)
      .post(operatorsOf(bravoId))
      .set(admin)
      .send({ email: "vale@example.com" })
      .expect(201);
    expect(first.body.invite).toEqual({ status: "sent" });
    const [userId] = [...supabase.users.keys()];
    // Vale accepts the invitation and sets a password.
    supabase.users.get(userId!)!.confirmed = true;
    supabase.calls.length = 0;

    const second = await request(app)
      .post(operatorsOf(altamiraId))
      .set(admin)
      .send({ email: "Vale@Example.com" })
      .expect(201);
    expect(second.body.invite).toEqual({ status: "linked" });
    expect(second.body.operator).toMatchObject({
      email: "vale@example.com",
      hasLogin: true,
    });

    const created = await request(app)
      .post("/internal/companies")
      .set(admin)
      .send({
        name: "Delta",
        slug: "delta",
        operatorEmail: "vale@example.com",
      })
      .expect(201);
    expect(created.body.invite).toEqual({ status: "linked" });
    expect(created.body.company.operators).toMatchObject([
      { email: "vale@example.com" },
    ]);

    expect(supabase.calls.map((call) => `${call.method} ${call.path}`)).toEqual(
      ["POST /invite", "GET /admin/users", "POST /invite", "GET /admin/users"],
    );
    expect(supabase.users.size).toBe(1);
    const rows = await db.operator.findMany({
      where: { email: "vale@example.com" },
    });
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.supabaseUserId))).toEqual(
      new Set([userId]),
    );

    const duplicate = await request(app)
      .post(operatorsOf(altamiraId))
      .set(admin)
      .send({ email: "vale@example.com" })
      .expect(409);
    expect(duplicate.body.error).toEqual({
      code: "email_taken",
      message: "Ese email ya es operador de esta empresa.",
    });
    expect(
      await db.operator.count({ where: { email: "vale@example.com" } }),
    ).toBe(3);
  });
});

describe("an operator of several companies", () => {
  beforeEach(async () => {
    await addOperator(bravoId, "ana@example.com");
    await addOperator(altamiraId, "ana@example.com");
  });

  it("lists their active companies by name and switches with X-Company-Id", async () => {
    const archivedCompany = await createCompany(db, {
      slug: "archivada",
      name: "Archivada",
    });
    await db.company.update({
      where: { id: archivedCompany.id },
      data: { archivedAt: new Date() },
    });
    await addOperator(archivedCompany.id, "ana@example.com");
    await db.operator.create({
      data: {
        companyId: costaId,
        email: "ana@example.com",
        archivedAt: new Date(),
      },
    });
    const companies = [
      { id: altamiraId, name: "Altamira", slug: "altamira" },
      { id: bravoId, name: "Bravo", slug: "bravo" },
    ].map((company) => ({ ...company, assistantPaused: false }));

    const fallback = await request(app)
      .get("/internal/me")
      .set(ana)
      .expect(200);
    expect(fallback.body).toMatchObject({
      operator: { email: "ana@example.com" },
      company: { id: bravoId, name: "Bravo" },
      platformAdmin: false,
      supportAccess: false,
    });
    expect(fallback.body.companies).toEqual(companies);

    const switched = await request(app)
      .get("/internal/me")
      .set(ana)
      .set(inCompany(altamiraId))
      .expect(200);
    expect(switched.body).toMatchObject({
      company: { id: altamiraId, name: "Altamira", slug: "altamira" },
      supportAccess: false,
    });
    expect(switched.body.companies).toEqual(companies);
    expect(await db.adminAuditEntry.count()).toBe(0);
  });

  it("scopes reads and writes to the selected company, and refuses one they are not in", async () => {
    const bravoThread = await makeThread(bravoId, "Lead de Bravo");
    const altamiraThread = await makeThread(altamiraId, "Lead de Altamira");
    const costaThread = await makeThread(costaId, "Lead de Costa");
    const rowIn = async (companyId: string) =>
      (
        await db.operator.findUniqueOrThrow({
          where: { companyId_email: { companyId, email: "ana@example.com" } },
        })
      ).id;

    for (const [companyId, name] of [
      [bravoId, "Lead de Bravo"],
      [altamiraId, "Lead de Altamira"],
    ] as const) {
      const listed = await request(app)
        .get("/internal/threads")
        .set(ana)
        .set(inCompany(companyId))
        .expect(200);
      expect(listed.body.threads.map((t: { name: string }) => t.name)).toEqual([
        name,
      ]);
    }

    const taken = await request(app)
      .post(`/internal/threads/${altamiraThread.id}/take`)
      .set(ana)
      .set(inCompany(altamiraId))
      .expect(200);
    expect(taken.body.thread.assignee.id).toBe(await rowIn(altamiraId));
    await request(app)
      .post(`/internal/threads/${bravoThread.id}/take`)
      .set(ana)
      .set(inCompany(altamiraId))
      .expect(404);

    await request(app)
      .put("/internal/settings/instructions")
      .set(ana)
      .set(inCompany(altamiraId))
      .send({ instructions: "Solo Altamira." })
      .expect(200);
    expect(await instructionsOf(altamiraId)).toBe("Solo Altamira.");
    expect(await instructionsOf(bravoId)).toBe("");

    const attempts = [
      () => request(app).get("/internal/me"),
      () => request(app).get("/internal/threads"),
      () => request(app).post(`/internal/threads/${costaThread.id}/take`),
      () => request(app).post(`/internal/threads/${bravoThread.id}/take`),
      () =>
        request(app)
          .put("/internal/settings/instructions")
          .send({ instructions: "Intruso." }),
    ];
    for (const attempt of attempts) {
      const refused = await attempt()
        .set(ana)
        .set(inCompany(costaId))
        .expect(403);
      expect(refused.body.error.code).toBe("company_not_accessible");
    }
    for (const companyId of [bravoId, costaId])
      expect(await instructionsOf(companyId)).toBe("");
    for (const thread of [bravoThread, costaThread])
      expect(
        (await db.thread.findUniqueOrThrow({ where: { id: thread.id } }))
          .assignedToId,
      ).toBeNull();
    expect(await db.adminAuditEntry.count()).toBe(0);
  });

  it("keeps the other company open when one membership or one company is archived", async () => {
    const meIn = (companyId?: string) => {
      const call = request(app).get("/internal/me").set(ana);
      return companyId ? call.set(inCompany(companyId)) : call;
    };
    const rowIn = async (companyId: string) =>
      (
        await db.operator.findUniqueOrThrow({
          where: { companyId_email: { companyId, email: "ana@example.com" } },
        })
      ).id;

    await request(app)
      .post(`${operatorsOf(bravoId)}/${await rowIn(bravoId)}/archive`)
      .set(admin)
      .expect(200);
    expect((await meIn(bravoId).expect(403)).body.error.code).toBe(
      "operator_archived",
    );
    for (const companyId of [altamiraId, undefined]) {
      const me = await meIn(companyId).expect(200);
      expect(me.body.company.id).toBe(altamiraId);
      expect(me.body.companies.map((c: { id: string }) => c.id)).toEqual([
        altamiraId,
      ]);
    }
    await request(app)
      .post(`${operatorsOf(altamiraId)}/${await rowIn(altamiraId)}/archive`)
      .set(admin)
      .expect(200);
    for (const companyId of [altamiraId, undefined])
      expect((await meIn(companyId).expect(403)).body.error.code).toBe(
        "operator_archived",
      );

    await db.operator.updateMany({ data: { archivedAt: null } });
    await request(app)
      .post(`/internal/companies/${bravoId}/archive`)
      .set(admin)
      .expect(200);
    expect((await meIn(bravoId).expect(403)).body.error.code).toBe(
      "company_archived",
    );
    for (const companyId of [altamiraId, undefined])
      expect((await meIn(companyId).expect(200)).body.company.id).toBe(
        altamiraId,
      );
    await request(app)
      .post(`/internal/companies/${altamiraId}/archive`)
      .set(admin)
      .expect(200);
    for (const companyId of [altamiraId, undefined])
      expect((await meIn(companyId).expect(403)).body.error.code).toBe(
        "company_archived",
      );
  });
});

describe("removing one membership", () => {
  async function addThroughEmpresas(companyId: string) {
    const added = await request(app)
      .post(operatorsOf(companyId))
      .set(admin)
      .send({ email: "ana@example.com" })
      .expect(201);
    return added.body.operator.id as string;
  }

  it("keeps the login while another company still has the operator", async () => {
    const inBravo = await addThroughEmpresas(bravoId);
    const inAltamira = await addThroughEmpresas(altamiraId);
    expect(supabase.users.size).toBe(1);

    const first = await request(app)
      .delete(`${operatorsOf(bravoId)}/${inBravo}`)
      .set(admin)
      .expect(200);
    expect(first.body.authUser).toEqual({ status: "kept_operator" });
    expect(supabase.users.size).toBe(1);
    const me = await request(app).get("/internal/me").set(ana).expect(200);
    expect(me.body.company.id).toBe(altamiraId);

    const last = await request(app)
      .delete(`${operatorsOf(altamiraId)}/${inAltamira}`)
      .set(admin)
      .expect(200);
    expect(last.body.authUser).toEqual({ status: "removed" });
    expect(supabase.users.size).toBe(0);
  });

  it("keeps the login when a deleted company's operator is still in another company", async () => {
    await addThroughEmpresas(bravoId);
    await addThroughEmpresas(altamiraId);

    const deleted = await request(app)
      .delete(`/internal/companies/${bravoId}`)
      .set(admin)
      .send({ confirmSlug: "bravo" })
      .expect(200);
    expect(deleted.body.authUsers).toEqual({
      removed: 0,
      kept: 1,
      failed: [],
    });
    expect(supabase.users.size).toBe(1);
    const me = await request(app).get("/internal/me").set(ana).expect(200);
    expect(me.body.company.id).toBe(altamiraId);
    expect(me.body.companies.map((c: { id: string }) => c.id)).toEqual([
      altamiraId,
    ]);
  });
});

describe("Supabase sessions", () => {
  const jwtSecret = new TextEncoder().encode(
    "legacy-hs256-secret-that-is-32b!!",
  );
  const tokenFor = (sub: string, email: string) =>
    new SignJWT({ email, role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(sub)
      .setIssuer(`${SUPABASE_URL}/auth/v1`)
      .setAudience("authenticated")
      .setExpirationTime("1h")
      .sign(jwtSecret);

  it("links every unlinked row of that email on first login", async () => {
    app = makeApp({
      AUTH_MODE: "supabase",
      SUPABASE_URL,
      SUPABASE_JWT_SECRET: "legacy-hs256-secret-that-is-32b!!",
    });
    await addOperator(bravoId, "ana@example.com");
    await addOperator(altamiraId, "ana@example.com");
    // Costa already links this Supabase user to a row with Ana's old email.
    await db.operator.create({
      data: {
        companyId: costaId,
        email: "ana.vieja@example.com",
        supabaseUserId: "sb-ana",
        createdAt: new Date(Date.UTC(2026, 0, 2)),
      },
    });
    const costaRow = await addOperator(costaId, "ana@example.com");
    const auth = {
      Authorization: `Bearer ${await tokenFor("sb-ana", "Ana@Example.com")}`,
    };

    const me = await request(app).get("/internal/me").set(auth).expect(200);
    expect(me.body.operator).toEqual({ email: "ana@example.com" });
    expect(me.body.company.id).toBe(bravoId);
    expect(me.body.companies.map((c: { name: string }) => c.name)).toEqual([
      "Altamira",
      "Bravo",
      "Costa",
    ]);
    const linked = await db.operator.findMany({
      where: { supabaseUserId: "sb-ana" },
      select: { companyId: true },
    });
    expect(new Set(linked.map((row) => row.companyId))).toEqual(
      new Set([bravoId, altamiraId, costaId]),
    );
    expect(
      (await db.operator.findUniqueOrThrow({ where: { id: costaRow.id } }))
        .supabaseUserId,
    ).toBeNull();

    const switched = await request(app)
      .get("/internal/me")
      .set(auth)
      .set(inCompany(altamiraId))
      .expect(200);
    expect(switched.body.company.id).toBe(altamiraId);
  });
});

describe("a platform admin who is also an operator", () => {
  it("switches between their companies as an operator, and enters any other through audited support access", async () => {
    const inBravo = await addOperator(bravoId, "admin@example.com");
    const inAltamira = await addOperator(altamiraId, "admin@example.com");
    const threads = {
      [bravoId]: await makeThread(bravoId, "Lead de Bravo"),
      [altamiraId]: await makeThread(altamiraId, "Lead de Altamira"),
      [costaId]: await makeThread(costaId, "Lead de Costa"),
    };

    for (const [companyId, operatorId] of [
      [bravoId, inBravo.id],
      [altamiraId, inAltamira.id],
    ] as const) {
      const me = await request(app)
        .get("/internal/me")
        .set(admin)
        .set(inCompany(companyId))
        .expect(200);
      expect(me.body).toMatchObject({
        company: { id: companyId },
        platformAdmin: true,
        supportAccess: false,
      });
      expect(me.body.companies).toHaveLength(2);
      const taken = await request(app)
        .post(`/internal/threads/${threads[companyId]!.id}/take`)
        .set(admin)
        .set(inCompany(companyId))
        .expect(200);
      expect(taken.body.thread.assignee.id).toBe(operatorId);
    }
    expect(await db.adminAuditEntry.count()).toBe(0);

    const support = await request(app)
      .get("/internal/me")
      .set(admin)
      .set(inCompany(costaId))
      .expect(200);
    expect(support.body).toMatchObject({
      company: { id: costaId },
      platformAdmin: true,
      supportAccess: true,
    });
    await request(app)
      .post(`/internal/threads/${threads[costaId]!.id}/pause`)
      .set(admin)
      .set(inCompany(costaId))
      .expect(200);
    await waitForAudit();
    const entries = await db.adminAuditEntry.findMany();
    expect(
      entries.map(({ companyId, adminEmail, action }) => ({
        companyId,
        adminEmail,
        action,
      })),
    ).toEqual([
      {
        companyId: costaId,
        adminEmail: "admin@example.com",
        action: `POST /internal/threads/${threads[costaId]!.id}/pause`,
      },
    ]);
  });

  it("enters a company through support access when their own row there is archived", async () => {
    await db.operator.create({
      data: {
        companyId: bravoId,
        email: "admin@example.com",
        archivedAt: new Date(),
      },
    });
    await addOperator(altamiraId, "admin@example.com");

    const fallback = await request(app)
      .get("/internal/me")
      .set(admin)
      .expect(200);
    expect(fallback.body).toMatchObject({
      company: { id: altamiraId },
      supportAccess: false,
    });
    const entered = await request(app)
      .get("/internal/me")
      .set(admin)
      .set(inCompany(bravoId))
      .expect(200);
    expect(entered.body).toMatchObject({
      company: { id: bravoId },
      supportAccess: true,
    });
    expect(entered.body.companies.map((c: { id: string }) => c.id)).toEqual([
      altamiraId,
    ]);
  });
});
