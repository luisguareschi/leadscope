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
import {
  fakeSupabase,
  SERVICE_ROLE_KEY,
  SUPABASE_URL,
} from "../support/fake-supabase.js";

const db = testDb();
let app: ReturnType<typeof createApp>;
let supabase: ReturnType<typeof fakeSupabase>;
let altamiraId: string;
let otraId: string;

const admin = { Authorization: "Bearer dev:admin@example.com" };
const operator = { Authorization: "Bearer dev:operador@altamira.uy" };
const stranger = { Authorization: "Bearer dev:nadie@example.com" };
const operatorsOf = (companyId: string) =>
  `/internal/companies/${companyId}/operators`;

beforeEach(async () => {
  await resetDb();
  altamiraId = (await createCompany(db, { slug: "altamira" })).id;
  otraId = (await createCompany(db, { slug: "otra" })).id;
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId: altamiraId },
  });
  supabase = fakeSupabase();
  app = createApp(
    createTestContext({
      env: {
        PLATFORM_ADMIN_EMAILS: "admin@example.com",
        BACKOFFICE_ORIGIN: "https://panel.example.com",
      },
      authAdmin: supabase.authAdmin,
    }),
  );
});

async function waitForAudit() {
  await vi.waitFor(async () => {
    expect(await db.adminAuditEntry.count({ where: { status: null } })).toBe(0);
  });
}

describe("adding an operator", () => {
  it("creates the Supabase user, emails the invitation to set-password, and links the row", async () => {
    const added = await request(app)
      .post(operatorsOf(otraId))
      .set(admin)
      .send({ email: "  Nueva@Otra.uy " })
      .expect(201);

    expect(added.body.invite).toEqual({ status: "sent" });
    expect(added.body.operator).toMatchObject({
      email: "nueva@otra.uy",
      hasLogin: true,
      archivedAt: null,
      inviteError: null,
      platformAdmin: false,
    });
    expect(added.body.operator.invitedAt).toBeTruthy();
    expect(JSON.stringify(added.body)).not.toContain("sb-user");

    const invite = supabase.calls.find((call) => call.path === "/invite");
    expect(invite).toMatchObject({
      method: "POST",
      body: { email: "nueva@otra.uy" },
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    expect(invite?.query.get("redirect_to")).toBe(
      "https://panel.example.com/auth/set-password",
    );

    const row = await db.operator.findUniqueOrThrow({
      where: { email: "nueva@otra.uy" },
    });
    expect(row.companyId).toBe(otraId);
    expect(row.supabaseUserId).toBe([...supabase.users.keys()][0]);

    const listed = await request(app)
      .get(operatorsOf(otraId))
      .set(admin)
      .expect(200);
    expect(
      listed.body.operators.map((o: { email: string }) => o.email),
    ).toEqual(["nueva@otra.uy"]);
  });

  it("links a Supabase user that already exists instead of failing", async () => {
    const existingId = supabase.addConfirmedUser("ya.tenia@otra.uy");
    const added = await request(app)
      .post(operatorsOf(otraId))
      .set(admin)
      .send({ email: "ya.tenia@otra.uy" })
      .expect(201);

    expect(added.body.invite).toEqual({ status: "linked" });
    expect(supabase.calls.map((call) => `${call.method} ${call.path}`)).toEqual(
      ["POST /invite", "GET /admin/users"],
    );
    const row = await db.operator.findUniqueOrThrow({
      where: { email: "ya.tenia@otra.uy" },
    });
    expect(row.supabaseUserId).toBe(existingId);
    expect(row.inviteError).toBeNull();
    expect(supabase.users.size).toBe(1);
  });

  it("keeps the row with a Spanish reason when the invite fails, and a resend fixes it", async () => {
    supabase.failNextWith(429, {
      code: 429,
      error_code: "over_email_send_rate_limit",
      msg: "email rate limit exceeded",
    });
    const added = await request(app)
      .post(operatorsOf(otraId))
      .set(admin)
      .send({ email: "limite@otra.uy" })
      .expect(201);
    expect(added.body.invite.status).toBe("failed");
    expect(added.body.invite.message).toMatch(/límite de emails/);
    expect(added.body.operator).toMatchObject({
      hasLogin: false,
      invitedAt: null,
    });
    expect(added.body.operator.inviteError).toMatch(/límite de emails/);

    const resent = await request(app)
      .post(`${operatorsOf(otraId)}/${added.body.operator.id}/invite`)
      .set(admin)
      .expect(200);
    expect(resent.body.invite).toEqual({ status: "sent" });
    expect(resent.body.operator).toMatchObject({
      hasLogin: true,
      inviteError: null,
    });
  });

  it("resends a password-reset link to an operator whose account already has a password", async () => {
    supabase.addConfirmedUser("con.clave@otra.uy");
    const added = await request(app)
      .post(operatorsOf(otraId))
      .set(admin)
      .send({ email: "con.clave@otra.uy" })
      .expect(201);
    const resent = await request(app)
      .post(`${operatorsOf(otraId)}/${added.body.operator.id}/invite`)
      .set(admin)
      .expect(200);
    expect(resent.body.invite).toEqual({ status: "reset_sent" });
    const recover = supabase.calls.find((call) => call.path === "/recover");
    expect(recover?.body).toEqual({ email: "con.clave@otra.uy" });
    expect(recover?.query.get("redirect_to")).toBe(
      "https://panel.example.com/auth/set-password",
    );
  });

  it("says why when the server has no service role key", async () => {
    app = createApp(
      createTestContext({
        env: {
          PLATFORM_ADMIN_EMAILS: "admin@example.com",
          AUTH_MODE: "supabase",
          SUPABASE_URL,
          SUPABASE_JWT_SECRET: "legacy-hs256-secret-that-is-32b!!",
        },
      }),
    );
    const token = await adminToken();
    const added = await request(app)
      .post(operatorsOf(otraId))
      .set({ Authorization: `Bearer ${token}` })
      .send({ email: "sin.clave@otra.uy" })
      .expect(201);
    expect(added.body.invite.status).toBe("failed");
    expect(added.body.invite.message).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("refuses an email that is already an operator somewhere", async () => {
    const response = await request(app)
      .post(operatorsOf(otraId))
      .set(admin)
      .send({ email: "operador@altamira.uy" })
      .expect(409);
    expect(response.body.error.code).toBe("email_taken");
    expect(supabase.calls).toEqual([]);
  });

  it("invites the first operator when a company is created", async () => {
    const created = await request(app)
      .post("/internal/companies")
      .set(admin)
      .send({ name: "Costa Sur", slug: "costa-sur", operatorEmail: "a@cs.uy" })
      .expect(201);
    expect(created.body.invite).toEqual({ status: "sent" });
    expect(
      (await db.operator.findUniqueOrThrow({ where: { email: "a@cs.uy" } }))
        .supabaseUserId,
    ).toBeTruthy();
  });
});

const jwtSecret = new TextEncoder().encode("legacy-hs256-secret-that-is-32b!!");

function supabaseToken(sub: string, email: string) {
  return new SignJWT({ email, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer(`${SUPABASE_URL}/auth/v1`)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(jwtSecret);
}

const adminToken = () => supabaseToken("sb-admin", "admin@example.com");

describe("archiving an operator", () => {
  it("blocks that login on every panel route until it is restored", async () => {
    const row = await db.operator.findUniqueOrThrow({
      where: { email: "operador@altamira.uy" },
    });
    await request(app).get("/internal/me").set(operator).expect(200);

    const archived = await request(app)
      .post(`${operatorsOf(altamiraId)}/${row.id}/archive`)
      .set(admin)
      .expect(200);
    expect(archived.body.operator.archivedAt).toBeTruthy();

    const me = await request(app).get("/internal/me").set(operator).expect(403);
    expect(me.body.error.code).toBe("operator_archived");
    expect(me.body.error.message).toMatch(/archivado/);
    for (const path of ["/internal/threads", "/internal/settings"]) {
      const blocked = await request(app).get(path).set(operator).expect(403);
      expect(blocked.body.error.code).toBe("operator_archived");
    }

    await request(app)
      .post(`${operatorsOf(altamiraId)}/${row.id}/restore`)
      .set(admin)
      .expect(200);
    await request(app).get("/internal/threads").set(operator).expect(200);
  });

  it("blocks a real Supabase session of an archived operator", async () => {
    app = createApp(
      createTestContext({
        env: {
          PLATFORM_ADMIN_EMAILS: "admin@example.com",
          AUTH_MODE: "supabase",
          SUPABASE_URL,
          SUPABASE_JWT_SECRET: "legacy-hs256-secret-that-is-32b!!",
        },
        authAdmin: supabase.authAdmin,
      }),
    );
    await db.operator.update({
      where: { email: "operador@altamira.uy" },
      data: { supabaseUserId: "sb-op-1", archivedAt: new Date() },
    });
    const token = await supabaseToken("sb-op-1", "operador@altamira.uy");
    const me = await request(app)
      .get("/internal/me")
      .set({ Authorization: `Bearer ${token}` })
      .expect(403);
    expect(me.body.error.code).toBe("operator_archived");
    await request(app)
      .get("/internal/threads")
      .set({ Authorization: `Bearer ${token}` })
      .expect(403);
  });

  it("keeps Empresas open to a platform admin whose own operator row is archived", async () => {
    await db.operator.create({
      data: {
        email: "admin@example.com",
        companyId: altamiraId,
        archivedAt: new Date(),
      },
    });
    const me = await request(app).get("/internal/me").set(admin).expect(200);
    expect(me.body).toMatchObject({ platformAdmin: true, company: null });
    await request(app).get("/internal/companies").set(admin).expect(200);
  });
});

describe("deleting an operator", () => {
  it("removes the row and its Supabase user when nothing else uses it", async () => {
    const added = await request(app)
      .post(operatorsOf(otraId))
      .set(admin)
      .send({ email: "baja@otra.uy" })
      .expect(201);
    expect(supabase.users.size).toBe(1);

    const deleted = await request(app)
      .delete(`${operatorsOf(otraId)}/${added.body.operator.id}`)
      .set(admin)
      .expect(200);
    expect(deleted.body.authUser).toEqual({ status: "removed" });
    expect(supabase.users.size).toBe(0);
    expect(
      await db.operator.findUnique({ where: { email: "baja@otra.uy" } }),
    ).toBeNull();
  });

  it("keeps the Supabase user of an email on PLATFORM_ADMIN_EMAILS", async () => {
    const userId = supabase.addConfirmedUser("admin@example.com");
    const row = await db.operator.create({
      data: {
        email: "admin@example.com",
        companyId: otraId,
        supabaseUserId: userId,
      },
    });
    const deleted = await request(app)
      .delete(`${operatorsOf(otraId)}/${row.id}`)
      .set(admin)
      .expect(200);
    expect(deleted.body.authUser).toEqual({ status: "kept_platform_admin" });
    expect(supabase.users.has(userId)).toBe(true);
    expect(supabase.calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("answers 404 for an operator of another company", async () => {
    const row = await db.operator.findUniqueOrThrow({
      where: { email: "operador@altamira.uy" },
    });
    await request(app)
      .delete(`${operatorsOf(otraId)}/${row.id}`)
      .set(admin)
      .expect(404);
    expect(
      await db.operator.findUnique({ where: { id: row.id } }),
    ).not.toBeNull();
  });

  it("records every operator write in the audit log", async () => {
    const added = await request(app)
      .post(operatorsOf(otraId))
      .set(admin)
      .send({ email: "auditado@otra.uy" })
      .expect(201);
    const id = added.body.operator.id as string;
    await request(app)
      .post(`${operatorsOf(otraId)}/${id}/archive`)
      .set(admin)
      .expect(200);
    await request(app)
      .delete(`${operatorsOf(otraId)}/${id}`)
      .set(admin)
      .expect(200);
    await request(app).get(operatorsOf(otraId)).set(admin).expect(200);
    await waitForAudit();
    const entries = await db.adminAuditEntry.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(
      entries.map(({ action, status, companySlug, adminEmail }) => ({
        action,
        status,
        companySlug,
        adminEmail,
      })),
    ).toEqual([
      {
        action: `POST ${operatorsOf(otraId)}`,
        status: 201,
        companySlug: "otra",
        adminEmail: "admin@example.com",
      },
      {
        action: `POST ${operatorsOf(otraId)}/${id}/archive`,
        status: 200,
        companySlug: "otra",
        adminEmail: "admin@example.com",
      },
      {
        action: `DELETE ${operatorsOf(otraId)}/${id}`,
        status: 200,
        companySlug: "otra",
        adminEmail: "admin@example.com",
      },
    ]);
  });
});

describe("operator routes for non-admins", () => {
  it("answer 403 to operators and strangers, with or without support headers", async () => {
    const row = await db.operator.findUniqueOrThrow({
      where: { email: "operador@altamira.uy" },
    });
    const attempts = [
      () => request(app).get(operatorsOf(altamiraId)),
      () =>
        request(app).post(operatorsOf(altamiraId)).send({ email: "x@y.uy" }),
      () => request(app).post(`${operatorsOf(altamiraId)}/${row.id}/invite`),
      () => request(app).post(`${operatorsOf(altamiraId)}/${row.id}/archive`),
      () => request(app).post(`${operatorsOf(altamiraId)}/${row.id}/restore`),
      () => request(app).delete(`${operatorsOf(altamiraId)}/${row.id}`),
    ];
    for (const auth of [operator, stranger]) {
      for (const attempt of attempts) {
        await attempt().set(auth).expect(403);
        await attempt()
          .set(auth)
          .set({ "X-Company-Id": altamiraId })
          .expect(403);
      }
    }
    expect(await db.operator.count()).toBe(1);
    expect(
      (await db.operator.findUniqueOrThrow({ where: { id: row.id } }))
        .archivedAt,
    ).toBeNull();
    expect(supabase.calls).toEqual([]);
    expect(await db.adminAuditEntry.count()).toBe(0);
  });
});
