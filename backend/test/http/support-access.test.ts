import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { decryptSecrets } from "../../src/companies/company-secrets.js";
import { parseEncryptionKey } from "../../src/lib/crypto.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";
import { TEST_ENCRYPTION_KEY } from "../support/test-env.js";

const db = testDb();
const key = parseEncryptionKey(TEST_ENCRYPTION_KEY);
let app: ReturnType<typeof createApp>;
let altamiraId: string;
let otraId: string;
let altamiraThreadId: string;
let otraThreadId: string;

const admin = { Authorization: "Bearer dev:admin@example.com" };
const altamiraOperator = { Authorization: "Bearer dev:operador@altamira.uy" };
const stranger = { Authorization: "Bearer dev:nadie@example.com" };
const enter = (companyId: string) => ({ "X-Company-Id": companyId });

beforeEach(async () => {
  await resetDb();
  altamiraId = (await createCompany(db, { slug: "altamira" })).id;
  otraId = (await createCompany(db, { slug: "otra" })).id;
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId: altamiraId },
  });
  await db.operator.create({
    data: { email: "operador@otra.uy", companyId: otraId },
  });
  altamiraThreadId = (
    await db.thread.create({
      data: {
        companyId: altamiraId,
        phone: "+59899000001",
        waId: "59899000001",
        name: "Lead de Altamira",
        state: "answer",
        lastMessageAt: new Date(),
      },
    })
  ).id;
  otraThreadId = (
    await db.thread.create({
      data: {
        companyId: otraId,
        phone: "+59899000002",
        waId: "59899000002",
        name: "Lead de Otra",
        state: "answer",
        lastMessageAt: new Date(),
      },
    })
  ).id;
  app = createApp(
    createTestContext({ env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" } }),
  );
});

async function anthropicKeyOf(companyId: string) {
  const company = await db.company.findUniqueOrThrow({
    where: { id: companyId },
  });
  return decryptSecrets(company.encryptedSecrets, key).anthropicApiKey;
}

describe("support access", () => {
  it("lets a platform admin with no operator row read and write another company", async () => {
    await request(app).get("/internal/threads").set(admin).expect(403);

    const me = await request(app)
      .get("/internal/me")
      .set(admin)
      .set(enter(otraId))
      .expect(200);
    expect(me.body).toEqual({
      operator: null,
      company: { name: "otra", slug: "otra" },
      platformAdmin: true,
      supportAccess: true,
    });

    const threads = await request(app)
      .get("/internal/threads")
      .set(admin)
      .set(enter(otraId))
      .expect(200);
    expect(
      threads.body.threads.map((thread: { name: string }) => thread.name),
    ).toEqual(["Lead de Otra"]);
    await request(app)
      .get(`/internal/threads/${altamiraThreadId}`)
      .set(admin)
      .set(enter(otraId))
      .expect(404);

    const paused = await request(app)
      .post(`/internal/threads/${otraThreadId}/pause`)
      .set(admin)
      .set(enter(otraId))
      .expect(200);
    expect(paused.body.thread.paused).toBe(true);

    await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(admin)
      .set(enter(otraId))
      .send({ value: "sk-ant-support-written-42ab" })
      .expect(200);
    expect(await anthropicKeyOf(otraId)).toBe("sk-ant-support-written-42ab");
    expect(await anthropicKeyOf(altamiraId)).toBeUndefined();

    const uploaded = await request(app)
      .post("/internal/knowledge/files")
      .set(admin)
      .set(enter(otraId))
      .attach("file", Buffer.from("Torre Sur desde USD 150.000"), "precios.txt")
      .expect(201);
    expect(uploaded.body.file).toMatchObject({
      name: "precios.txt",
      uploadedBy: null,
    });
    expect(await db.knowledgeFile.count({ where: { companyId: otraId } })).toBe(
      1,
    );

    expect(
      await db.operator.findUnique({ where: { email: "admin@example.com" } }),
    ).toBeNull();
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: altamiraThreadId } }))
        .paused,
    ).toBe(false);
  });

  it("records every write the admin makes inside the company, and no reads", async () => {
    const support = () => ({ ...admin, ...enter(otraId) });
    await request(app).get("/internal/threads").set(support()).expect(200);
    await request(app)
      .post(`/internal/threads/${otraThreadId}/pause`)
      .set(support())
      .expect(200);
    await request(app)
      .put("/internal/secrets/hubspotAccessToken")
      .set(support())
      .send({ value: "pat-na1-never-in-the-log-77zz" })
      .expect(200);
    await request(app)
      .delete("/internal/threads/does-not-exist")
      .set(support())
      .expect(404);

    await vi.waitFor(async () => {
      const pending = await db.adminAuditEntry.count({
        where: { status: null },
      });
      expect(pending).toBe(0);
    });
    const entries = await db.adminAuditEntry.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(
      entries.map(({ companyId, adminEmail, action, status }) => ({
        companyId,
        adminEmail,
        action,
        status,
      })),
    ).toEqual([
      {
        companyId: otraId,
        adminEmail: "admin@example.com",
        action: `POST /internal/threads/${otraThreadId}/pause`,
        status: 200,
      },
      {
        companyId: otraId,
        adminEmail: "admin@example.com",
        action: "PUT /internal/secrets/hubspotAccessToken",
        status: 200,
      },
      {
        companyId: otraId,
        adminEmail: "admin@example.com",
        action: "DELETE /internal/threads/does-not-exist",
        status: 404,
      },
    ]);
    expect(entries.every((entry) => entry.createdAt instanceof Date)).toBe(
      true,
    );
    expect(JSON.stringify(entries)).not.toContain("never-in-the-log");
  });

  it("ignores the header for a normal operator, who still gets only their own company", async () => {
    const me = await request(app)
      .get("/internal/me")
      .set(altamiraOperator)
      .set(enter(otraId))
      .expect(200);
    expect(me.body).toEqual({
      operator: { email: "operador@altamira.uy" },
      company: { name: "altamira", slug: "altamira" },
      platformAdmin: false,
      supportAccess: false,
    });

    const threads = await request(app)
      .get("/internal/threads")
      .set(altamiraOperator)
      .set(enter(otraId))
      .expect(200);
    expect(
      threads.body.threads.map((thread: { name: string }) => thread.name),
    ).toEqual(["Lead de Altamira"]);
    await request(app)
      .get(`/internal/threads/${otraThreadId}`)
      .set(altamiraOperator)
      .set(enter(otraId))
      .expect(404);
    await request(app)
      .post(`/internal/threads/${otraThreadId}/pause`)
      .set(altamiraOperator)
      .set(enter(otraId))
      .expect(404);
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: otraThreadId } }))
        .paused,
    ).toBe(false);

    await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(altamiraOperator)
      .set(enter(otraId))
      .send({ value: "sk-ant-operator-own-11aa" })
      .expect(200);
    expect(await anthropicKeyOf(altamiraId)).toBe("sk-ant-operator-own-11aa");
    expect(await anthropicKeyOf(otraId)).toBeUndefined();

    await request(app)
      .post(`/internal/threads/${altamiraThreadId}/pause`)
      .set(altamiraOperator)
      .set(enter("does-not-exist"))
      .expect(200);
    expect(await db.adminAuditEntry.count()).toBe(0);
  });

  it("keeps an admin who is also an operator in their own company until they send the header", async () => {
    await db.operator.create({
      data: { email: "admin@example.com", companyId: altamiraId },
    });
    const own = await request(app)
      .get("/internal/threads")
      .set(admin)
      .expect(200);
    expect(
      own.body.threads.map((thread: { name: string }) => thread.name),
    ).toEqual(["Lead de Altamira"]);

    const entered = await request(app)
      .get("/internal/threads")
      .set(admin)
      .set(enter(otraId))
      .expect(200);
    expect(
      entered.body.threads.map((thread: { name: string }) => thread.name),
    ).toEqual(["Lead de Otra"]);
  });

  it("answers 404 when an admin enters a company that does not exist", async () => {
    const response = await request(app)
      .get("/internal/threads")
      .set(admin)
      .set(enter("does-not-exist"))
      .expect(404);
    expect(response.body.error.code).toBe("not_found");
    await request(app)
      .get("/internal/me")
      .set(admin)
      .set(enter("does-not-exist"))
      .expect(404);
  });

  it("gives non-admins 403 on Empresas and on company routes, with or without the header", async () => {
    for (const auth of [altamiraOperator, stranger]) {
      await request(app)
        .get("/internal/companies")
        .set(auth)
        .set(enter(otraId))
        .expect(403);
      await request(app)
        .post("/internal/companies")
        .set(auth)
        .set(enter(otraId))
        .send({
          name: "Intrusa",
          slug: "intrusa",
          operatorEmail: "intrusa@example.com",
        })
        .expect(403);
    }
    await request(app)
      .get("/internal/threads")
      .set(stranger)
      .set(enter(otraId))
      .expect(403);
    await request(app)
      .get("/internal/me")
      .set(stranger)
      .set(enter(otraId))
      .expect(403);
    expect(
      await db.company.findUnique({ where: { slug: "intrusa" } }),
    ).toBeNull();
  });

  it("lets the backoffice send the header across origins", async () => {
    const preflight = await request(app)
      .options("/internal/threads")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "authorization,x-company-id")
      .expect(204);
    expect(preflight.headers["access-control-allow-headers"]).toContain(
      "X-Company-Id",
    );
  });
});
