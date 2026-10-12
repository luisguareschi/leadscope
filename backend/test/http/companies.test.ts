import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { parseCompanyConfig } from "../../src/companies/company-config.js";
import { createApp } from "../../src/app.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

const db = testDb();
let app: ReturnType<typeof createApp>;
let altamiraId: string;
let otherThreadId: string;

const adminAuth = { Authorization: "Bearer dev:admin@example.com" };
const operatorAuth = { Authorization: "Bearer dev:operador@test.com" };

beforeEach(async () => {
  await resetDb();
  altamiraId = (await createCompany(db, { slug: "altamira" })).id;
  const other = await createCompany(db, { slug: "otra" });
  await db.operator.create({
    data: { email: "admin@example.com", companyId: altamiraId },
  });
  await db.operator.create({
    data: { email: "operador@test.com", companyId: altamiraId },
  });
  otherThreadId = (
    await db.thread.create({
      data: {
        companyId: other.id,
        phone: "+59899000999",
        waId: "59899000999",
        name: "Lead de otra empresa",
      },
    })
  ).id;
  app = createApp(
    createTestContext({
      env: {
        PLATFORM_ADMIN_EMAILS: " Admin@Example.com , other@example.com ",
      },
    }),
  );
});

describe("platform admin companies", () => {
  it("lets an allowlisted admin create a company with config and a first operator", async () => {
    const created = await request(app)
      .post("/internal/companies")
      .set(adminAuth)
      .send({
        name: "  Costa Sur  ",
        slug: "Costa-Sur",
        operatorEmail: "  Operador@CostaSur.uy  ",
        anthropicApiKey: "sk-ant-should-not-stick",
      })
      .expect(201);

    expect(created.body.company).toMatchObject({
      name: "Costa Sur",
      slug: "costa-sur",
      operators: [{ email: "operador@costasur.uy" }],
    });
    expect(created.body.company).not.toHaveProperty("config");
    expect(created.body.company).not.toHaveProperty("encryptedSecrets");
    expect(JSON.stringify(created.body)).not.toContain(
      "sk-ant-should-not-stick",
    );

    const row = await db.company.findUniqueOrThrow({
      where: { slug: "costa-sur" },
      include: { operators: true, threads: true, settingsVersions: true },
    });
    expect(row.instructions).toBe(
      "Costa Sur es una desarrolladora inmobiliaria.",
    );
    expect(
      row.settingsVersions.map(({ kind, createdByEmail }) => ({
        kind,
        createdByEmail,
      })),
    ).toEqual(
      expect.arrayContaining([
        { kind: "config", createdByEmail: "admin@example.com" },
        { kind: "instructions", createdByEmail: "admin@example.com" },
        { kind: "whatsappPhoneNumberId", createdByEmail: "admin@example.com" },
      ]),
    );
    expect(row.settingsVersions).toHaveLength(3);
    expect(row.encryptedSecrets).toBeNull();
    expect(row.whatsappPhoneNumberId).toBeNull();
    expect(row.threads).toEqual([]);
    expect(row.operators.map((operator) => operator.email)).toEqual([
      "operador@costasur.uy",
    ]);
    const config = parseCompanyConfig(row.config);
    expect(config.displayName).toBe("Costa Sur");
    expect(config.questions.budget.length).toBeGreaterThan(0);
    expect(config.knowledge.maxCharsPerFile).toBe(60_000);
    expect(config.llm.model).toBe("claude-haiku-4-5");
    expect(config.whatsapp.welcomeTemplate).toBeNull();

    const listed = await request(app)
      .get("/internal/companies")
      .set(adminAuth)
      .expect(200);
    expect(
      listed.body.companies.map((company: { slug: string }) => company.slug),
    ).toEqual(["costa-sur", "otra", "altamira"]);
    expect(JSON.stringify(listed.body)).not.toContain("Lead de otra empresa");
    expect(JSON.stringify(listed.body)).not.toContain("encryptedSecrets");

    const me = await request(app)
      .get("/internal/me")
      .set(adminAuth)
      .expect(200);
    expect(me.body.platformAdmin).toBe(true);
    expect(me.body.company).toEqual({ name: "altamira", slug: "altamira" });

    await request(app)
      .get(`/internal/threads/${otherThreadId}`)
      .set(adminAuth)
      .expect(404);
    const threads = await request(app)
      .get("/internal/threads")
      .set(adminAuth)
      .expect(200);
    expect(threads.body.threads).toEqual([]);
  });

  it("refuses a duplicate slug or an email that already belongs to a company", async () => {
    const slug = await request(app)
      .post("/internal/companies")
      .set(adminAuth)
      .send({
        name: "Otra vez",
        slug: "otra",
        operatorEmail: "nuevo@example.com",
      })
      .expect(409);
    expect(slug.body.error.code).toBe("slug_taken");

    const email = await request(app)
      .post("/internal/companies")
      .set(adminAuth)
      .send({
        name: "Nueva",
        slug: "nueva",
        operatorEmail: "operador@test.com",
      })
      .expect(409);
    expect(email.body.error.code).toBe("email_taken");
    expect(
      await db.company.findUnique({ where: { slug: "nueva" } }),
    ).toBeNull();
  });

  it("hides the routes from a normal operator", async () => {
    const me = await request(app)
      .get("/internal/me")
      .set(operatorAuth)
      .expect(200);
    expect(me.body.platformAdmin).toBe(false);

    const listed = await request(app)
      .get("/internal/companies")
      .set(operatorAuth)
      .expect(403);
    expect(listed.body.error.code).toBe("forbidden");

    const created = await request(app)
      .post("/internal/companies")
      .set(operatorAuth)
      .send({
        name: "No deberia",
        slug: "no-deberia",
        operatorEmail: "intruso@example.com",
      })
      .expect(403);
    expect(created.body.error.code).toBe("forbidden");
    expect(
      await db.company.findUnique({ where: { slug: "no-deberia" } }),
    ).toBeNull();
    expect(
      await db.operator.findUnique({ where: { email: "intruso@example.com" } }),
    ).toBeNull();
  });
});

describe("empty database", () => {
  it("lets an allowlisted admin with no operator create the first company", async () => {
    await resetDb();
    app = createApp(
      createTestContext({
        env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
      }),
    );
    expect(await db.company.count()).toBe(0);
    expect(await db.operator.count()).toBe(0);

    const me = await request(app)
      .get("/internal/me")
      .set(adminAuth)
      .expect(200);
    expect(me.body).toEqual({
      operator: null,
      company: null,
      platformAdmin: true,
      supportAccess: false,
    });

    await request(app).get("/internal/threads").set(adminAuth).expect(403);

    const created = await request(app)
      .post("/internal/companies")
      .set(adminAuth)
      .send({
        name: "Altamira",
        slug: "altamira",
        operatorEmail: "operador@altamira.uy",
      })
      .expect(201);
    expect(created.body.company).toMatchObject({
      name: "Altamira",
      slug: "altamira",
      operators: [{ email: "operador@altamira.uy" }],
    });

    const listed = await request(app)
      .get("/internal/companies")
      .set(adminAuth)
      .expect(200);
    expect(listed.body.companies).toHaveLength(1);
    expect(listed.body.companies[0].slug).toBe("altamira");
    expect(
      await db.operator.findUnique({ where: { email: "admin@example.com" } }),
    ).toBeNull();

    const operatorAuth = {
      Authorization: "Bearer dev:operador@altamira.uy",
    };
    const operatorMe = await request(app)
      .get("/internal/me")
      .set(operatorAuth)
      .expect(200);
    expect(operatorMe.body).toEqual({
      operator: { email: "operador@altamira.uy" },
      company: { name: "Altamira", slug: "altamira" },
      platformAdmin: false,
      supportAccess: false,
    });
    await request(app).get("/internal/companies").set(operatorAuth).expect(403);

    const stranger = { Authorization: "Bearer dev:nadie@example.com" };
    await request(app).get("/internal/me").set(stranger).expect(403);
    await request(app).get("/internal/companies").set(stranger).expect(403);
    await request(app)
      .post("/internal/companies")
      .set(stranger)
      .send({
        name: "Otra",
        slug: "otra",
        operatorEmail: "otro@example.com",
      })
      .expect(403);
    expect(await db.company.count()).toBe(1);
  });
});
