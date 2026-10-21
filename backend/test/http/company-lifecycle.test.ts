import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { processThread } from "../../src/conversation/process-thread.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
  type TestContext,
  settle,
} from "../support/harness.js";
import { fakeSupabase } from "../support/fake-supabase.js";
import {
  kapsoMessageReceived,
  postKapsoWebhook,
} from "../support/kapso-webhooks.js";

const db = testDb();
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let supabase: ReturnType<typeof fakeSupabase>;
let altamiraId: string;
let otraId: string;

const admin = { Authorization: "Bearer dev:admin@example.com" };
const operator = { Authorization: "Bearer dev:operador@altamira.uy" };
const stranger = { Authorization: "Bearer dev:nadie@example.com" };

beforeEach(async () => {
  await resetDb();
  altamiraId = (
    await createCompany(db, { slug: "altamira", phoneNumberId: "PNID" })
  ).id;
  otraId = (await createCompany(db, { slug: "otra" })).id;
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId: altamiraId },
  });
  supabase = fakeSupabase();
  ctx = createTestContext({
    env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
    authAdmin: supabase.authAdmin,
  });
  app = createApp(ctx);
});

afterEach(() => settle(ctx));

function postWhatsapp(text: string) {
  return postKapsoWebhook(
    app,
    "altamira",
    kapsoMessageReceived({ phoneNumberId: "PNID", text }),
  ).expect(200);
}

const slugs = (body: { companies: Array<{ slug: string }> }) =>
  body.companies.map((company) => company.slug);

describe("archiving a company", () => {
  it("blocks its operators, support access, the webhook, and form leads, and hides it from the list", async () => {
    await request(app).get("/internal/me").set(operator).expect(200);

    const archived = await request(app)
      .post(`/internal/companies/${altamiraId}/archive`)
      .set(admin)
      .expect(200);
    expect(archived.body.company.archivedAt).toBeTruthy();

    const me = await request(app).get("/internal/me").set(operator).expect(403);
    expect(me.body.error.code).toBe("company_archived");
    await request(app).get("/internal/threads").set(operator).expect(403);
    await request(app)
      .get("/internal/knowledge/files")
      .set(operator)
      .expect(403);

    const entered = await request(app)
      .get("/internal/threads")
      .set(admin)
      .set({ "X-Company-Id": altamiraId })
      .expect(403);
    expect(entered.body.error.code).toBe("company_archived");

    await postWhatsapp("Hola, ¿siguen vendiendo?");
    await settle(ctx);
    expect(await db.message.count()).toBe(0);
    expect(await db.thread.count({ where: { companyId: altamiraId } })).toBe(0);
    expect(ctx.integrations.fakes.channel.sent).toEqual([]);

    await request(app)
      .post("/hooks/crm/form-lead/altamira")
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "099 123 456" })
      .expect(404);

    const active = await request(app)
      .get("/internal/companies")
      .set(admin)
      .expect(200);
    expect(slugs(active.body)).toEqual(["otra"]);
    const onlyArchived = await request(app)
      .get("/internal/companies?status=archived")
      .set(admin)
      .expect(200);
    expect(slugs(onlyArchived.body)).toEqual(["altamira"]);
    const all = await request(app)
      .get("/internal/companies?status=all")
      .set(admin)
      .expect(200);
    expect(slugs(all.body)).toEqual(["otra", "altamira"]);
  });

  it("stops answering a thread whose company was archived after the message arrived", async () => {
    const thread = await db.thread.create({
      data: {
        companyId: altamiraId,
        phone: "+59899111333",
        waId: "59899111333",
        lastInboundAt: new Date(),
      },
    });
    await db.message.create({
      data: {
        companyId: altamiraId,
        threadId: thread.id,
        direction: "inbound",
        type: "text",
        body: "Hola",
      },
    });
    await db.company.update({
      where: { id: altamiraId },
      data: { archivedAt: new Date() },
    });
    await expect(processThread(ctx, thread.id)).resolves.toBe(
      "company_archived",
    );
    expect(await db.message.count({ where: { direction: "outbound" } })).toBe(
      0,
    );
  });

  it("restores everything on restore", async () => {
    await request(app)
      .post(`/internal/companies/${altamiraId}/archive`)
      .set(admin)
      .expect(200);
    const restored = await request(app)
      .post(`/internal/companies/${altamiraId}/restore`)
      .set(admin)
      .expect(200);
    expect(restored.body.company.archivedAt).toBeNull();

    await request(app).get("/internal/threads").set(operator).expect(200);
    await request(app)
      .get("/internal/threads")
      .set(admin)
      .set({ "X-Company-Id": altamiraId })
      .expect(200);

    await postWhatsapp("Hola");
    await settle(ctx);
    const outbound = await db.message.findMany({
      where: { direction: "outbound" },
    });
    expect(outbound.map((message) => message.body)).toEqual([
      "Respuesta de prueba.",
    ]);
    const listed = await request(app)
      .get("/internal/companies")
      .set(admin)
      .expect(200);
    expect(slugs(listed.body)).toEqual(["otra", "altamira"]);
  });
});

describe("deleting a company", () => {
  it("requires the slug typed back and leaves the company untouched otherwise", async () => {
    for (const body of [{}, { confirmSlug: "otra" }, { confirmSlug: "alta" }]) {
      const refused = await request(app)
        .delete(`/internal/companies/${altamiraId}`)
        .set(admin)
        .send(body)
        .expect(400);
      expect(refused.body.error.code).toBe("slug_mismatch");
    }
    expect(
      await db.company.findUnique({ where: { id: altamiraId } }),
    ).not.toBeNull();
    expect(await db.operator.count({ where: { companyId: altamiraId } })).toBe(
      1,
    );
  });

  it("removes the company and its data, its operators' Supabase users, and keeps the audit entry", async () => {
    const thread = await db.thread.create({
      data: {
        companyId: altamiraId,
        phone: "+59899000001",
        waId: "59899000001",
      },
    });
    await db.message.create({
      data: {
        companyId: altamiraId,
        threadId: thread.id,
        direction: "inbound",
        type: "text",
        body: "Hola",
      },
    });
    await db.knowledgeFile.create({
      data: {
        companyId: altamiraId,
        name: "precios.txt",
        nameKey: "precios.txt",
        format: "txt",
        mimeType: "text/plain",
        sizeBytes: 10,
        sha256: "x",
        text: "precios",
        charCount: 7,
      },
    });
    const userId = supabase.addConfirmedUser("operador@altamira.uy");
    await db.operator.update({
      where: { email: "operador@altamira.uy" },
      data: { supabaseUserId: userId },
    });
    const adminUserId = supabase.addConfirmedUser("admin@example.com");
    await db.operator.create({
      data: {
        email: "admin@example.com",
        companyId: altamiraId,
        supabaseUserId: adminUserId,
      },
    });

    const deleted = await request(app)
      .delete(`/internal/companies/${altamiraId}`)
      .set(admin)
      .send({ confirmSlug: " Altamira " })
      .expect(200);
    expect(deleted.body).toEqual({
      deleted: { id: altamiraId, slug: "altamira" },
      authUsers: { removed: 1, kept: 1, failed: [] },
    });

    expect(
      await db.company.findUnique({ where: { id: altamiraId } }),
    ).toBeNull();
    for (const count of [
      db.operator.count({ where: { companyId: altamiraId } }),
      db.thread.count({ where: { companyId: altamiraId } }),
      db.message.count({ where: { companyId: altamiraId } }),
      db.knowledgeFile.count({ where: { companyId: altamiraId } }),
      db.companySettingsVersion.count({ where: { companyId: altamiraId } }),
    ])
      expect(await count).toBe(0);
    expect(supabase.users.has(userId)).toBe(false);
    expect(supabase.users.has(adminUserId)).toBe(true);
    expect(
      await db.company.findUnique({ where: { id: otraId } }),
    ).not.toBeNull();

    await vi.waitFor(async () => {
      expect(await db.adminAuditEntry.count({ where: { status: null } })).toBe(
        0,
      );
    });
    const entries = await db.adminAuditEntry.findMany();
    expect(
      entries.map(({ companyId, companySlug, adminEmail, action, status }) => ({
        companyId,
        companySlug,
        adminEmail,
        action,
        status,
      })),
    ).toEqual([
      {
        companyId: null,
        companySlug: "altamira",
        adminEmail: "admin@example.com",
        action: `DELETE /internal/companies/${altamiraId}`,
        status: 200,
      },
    ]);
  });

  it("answers 404 for a company that does not exist", async () => {
    await request(app)
      .delete("/internal/companies/does-not-exist")
      .set(admin)
      .send({ confirmSlug: "does-not-exist" })
      .expect(404);
    expect(await db.adminAuditEntry.count()).toBe(0);
  });
});

describe("company lifecycle routes for non-admins", () => {
  it("answer 403 on archive, restore, delete, and the archived list", async () => {
    const attempts = [
      () => request(app).get("/internal/companies?status=archived"),
      () => request(app).post(`/internal/companies/${altamiraId}/archive`),
      () => request(app).post(`/internal/companies/${altamiraId}/restore`),
      () =>
        request(app)
          .delete(`/internal/companies/${altamiraId}`)
          .send({ confirmSlug: "altamira" }),
    ];
    for (const auth of [operator, stranger]) {
      for (const attempt of attempts) {
        const response = await attempt().set(auth).expect(403);
        expect(response.body.error.code).toBe("forbidden");
        await attempt()
          .set(auth)
          .set({ "X-Company-Id": altamiraId })
          .expect(403);
      }
    }
    const company = await db.company.findUniqueOrThrow({
      where: { id: altamiraId },
    });
    expect(company.archivedAt).toBeNull();
    expect(await db.adminAuditEntry.count()).toBe(0);
  });
});
