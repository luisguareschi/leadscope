import { readFileSync } from "node:fs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  parseCompanyConfig,
  upgradeLegacyConfig,
} from "../../src/companies/company-config.js";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { processThread } from "../../src/conversation/process-thread.js";
import {
  createCompany,
  createTestContext,
  inbound,
  resetDb,
  testDb,
  type TestContext,
} from "../support/harness.js";

const db = testDb();
const MIGRATION = readFileSync(
  new URL(
    "../../prisma/migrations/20261020120000_collect_items_and_forbidden_flag/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

/** A config as Configuración saved it before Oct 2026: three questions and regex patterns. */
const legacyConfig = {
  displayName: "Altamira",
  language: "es-UY",
  tone: "Con voseo.",
  timezone: "America/Montevideo",
  defaultCountry: "UY",
  businessHours: "",
  questions: {
    interest: "¿Qué estás buscando?",
    budget: "¿Con qué presupuesto aproximado contás?",
    knowsProjects: "¿Ya conocés nuestros proyectos?",
  },
  forbiddenTopics: {
    describe: ["Rentabilidad futura"],
    patterns: ["rentabilidad", "\\broi\\b"],
  },
  messages: {
    fallback: "Te contacta un asesor.",
    needsHuman: "Lo ve un asesor.",
    nonText: "¿Me lo escribís?",
  },
  maxReplyChars: 600,
  llm: {
    model: "claude-haiku-4-5",
    temperature: 0.4,
    historyLimit: 40,
    timeoutMs: 25_000,
  },
  knowledge: {
    maxFileBytes: 15 * 1024 * 1024,
    maxCharsPerFile: 60_000,
    maxCharsTotal: 150_000,
  },
  crm: { provider: "hubspot", transcriptProperty: "" },
  whatsapp: { welcomeTemplate: null },
};

const upgradedCollect = [
  {
    key: "interest",
    name: "Interés",
    description: "¿Qué estás buscando?",
    required: true,
  },
  {
    key: "budget",
    name: "Presupuesto",
    description: "¿Con qué presupuesto aproximado contás?",
    required: true,
  },
  {
    key: "knowsProjects",
    name: "Conoce los proyectos",
    description: "¿Ya conocés nuestros proyectos?",
    required: true,
  },
];

class Rollback extends Error {}

/** Runs SQL from the migration in one transaction that is always rolled back. */
async function inRolledBackTransaction<T>(
  work: (
    tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  ) => Promise<T>,
): Promise<T> {
  let result: T | undefined;
  await db
    .$transaction(async (tx) => {
      result = await work(tx);
      throw new Rollback();
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) throw error;
    });
  return result as T;
}

describe("the migration SQL", () => {
  it("upgrades a stored config exactly like the app does", async () => {
    const fn = MIGRATION.slice(
      MIGRATION.indexOf("CREATE FUNCTION"),
      MIGRATION.indexOf("LANGUAGE plpgsql IMMUTABLE;") +
        "LANGUAGE plpgsql IMMUTABLE;".length,
    ).replace(
      'CREATE FUNCTION "leadscope_upgrade_config"',
      "CREATE FUNCTION pg_temp.leadscope_upgrade_config",
    );
    const current = parseCompanyConfig(legacyConfig);
    const [legacy, already] = await inRolledBackTransaction(async (tx) => {
      await tx.$executeRawUnsafe(fn);
      const run = async (value: unknown) =>
        (
          await tx.$queryRawUnsafe<Array<{ upgraded: unknown }>>(
            "SELECT pg_temp.leadscope_upgrade_config($1::jsonb) AS upgraded",
            JSON.stringify(value),
          )
        )[0]!.upgraded;
      return [await run(legacyConfig), await run(current)];
    });
    // The later name split (20261022090000) moves displayName; the app reads both steps at once.
    expect(upgradeLegacyConfig(legacy)).toEqual(
      upgradeLegacyConfig(legacyConfig),
    );
    expect(legacy).toMatchObject({
      collect: upgradedCollect,
      forbiddenTopics: { describe: ["Rentabilidad futura"] },
    });
    expect(legacy).not.toHaveProperty("questions");
    expect(already).toEqual(JSON.parse(JSON.stringify(current)));
  });

  it("moves each thread's three answers to the same keys, knowsProjects as Sí or No", async () => {
    const threadPart = MIGRATION.slice(
      MIGRATION.indexOf('ALTER TABLE "Thread"'),
    );
    const rows = await inRolledBackTransaction(async (tx) => {
      // Shadows the real table for this transaction, with the columns it had before.
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE "Thread" ("id" TEXT, "interest" TEXT, "budget" TEXT, "knowsProjects" BOOLEAN) ON COMMIT DROP',
      );
      await tx.$executeRawUnsafe(`INSERT INTO "Thread" VALUES
        ('a', '2 dormitorios', 'USD 150.000', false),
        ('b', 'Para invertir', '  ', true),
        ('c', NULL, NULL, NULL)`);
      for (const statement of threadPart.split(";").map((part) => part.trim()))
        if (statement) await tx.$executeRawUnsafe(statement);
      return tx.$queryRawUnsafe<Array<Record<string, unknown>>>(
        'SELECT * FROM "Thread" ORDER BY "id"',
      );
    });
    expect(rows).toEqual([
      {
        id: "a",
        collected: {
          interest: "2 dormitorios",
          budget: "USD 150.000",
          knowsProjects: "No",
        },
        summary: null,
      },
      {
        id: "b",
        collected: { interest: "Para invertir", knowsProjects: "Sí" },
        summary: null,
      },
      { id: "c", collected: {}, summary: null },
    ]);
  });
});

describe("a company and threads saved before configurable items", () => {
  let ctx: TestContext;
  let app: ReturnType<typeof createApp>;
  let companyId: string;
  const operator = { Authorization: "Bearer dev:operador@altamira.uy" };

  beforeEach(async () => {
    await resetDb();
    companyId = (await createCompany(db, { slug: "altamira" })).id;
    await db.company.update({
      where: { id: companyId },
      data: { config: legacyConfig },
    });
    await db.operator.create({
      data: { email: "operador@altamira.uy", companyId },
    });
    ctx = createTestContext();
    app = createApp(ctx);
  });

  it("loads in Configuración with the three items, required, and no patterns, and saves back", async () => {
    const settings = await request(app)
      .get("/internal/settings")
      .set(operator)
      .expect(200);
    expect(settings.body.config.collect).toEqual(upgradedCollect);
    expect(settings.body.config.forbiddenTopics).toEqual({
      describe: ["Rentabilidad futura"],
    });
    expect(settings.body.platformRules).toContain(
      "   - Presupuesto [budget] (required): ¿Con qué presupuesto aproximado contás?",
    );

    await request(app)
      .put("/internal/settings/config")
      .set(operator)
      .send({ ...settings.body.config, tone: "Más breve." })
      .expect(200);
    const stored = (
      await db.company.findUniqueOrThrow({ where: { id: companyId } })
    ).config;
    expect(stored).not.toHaveProperty("questions");
    expect(stored).toMatchObject({ collect: upgradedCollect });
  });

  it("restores a version saved in the old shape", async () => {
    const old = await db.companySettingsVersion.create({
      data: {
        companyId,
        kind: "config",
        config: { ...legacyConfig, tone: "Tono viejo." },
        createdAt: new Date("2026-01-02"),
      },
    });
    const versions = await request(app)
      .get("/internal/settings/versions")
      .set(operator)
      .expect(200);
    expect(
      versions.body.versions.find((v: { id: string }) => v.id === old.id).config
        .collect,
    ).toEqual(upgradedCollect);

    const restored = await request(app)
      .post(`/internal/settings/versions/${old.id}/restore`)
      .set(operator)
      .expect(200);
    expect(restored.body.settings.config).toMatchObject({
      tone: "Tono viejo.",
      collect: upgradedCollect,
    });
  });

  it("keeps a migrated thread's answers: the gate counts them and the panel shows them", async () => {
    const recorded = await recordInboundMessage(
      ctx,
      inbound("PNID-altamira", { body: "Hola" }),
    );
    if (recorded.status !== "recorded") throw new Error(recorded.status);
    await db.thread.update({
      where: { id: recorded.threadId },
      data: {
        state: "qualify",
        collected: { interest: "2 dormitorios", knowsProjects: "No" },
      },
    });
    ctx.llm.push({
      reply: "¿Cuándo te llama un asesor?",
      collected: { budget: "USD 150.000" },
    });
    await processThread(ctx, recorded.threadId);
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: recorded.threadId } }))
        .state,
    ).toBe("handoff");

    const view = await request(app)
      .get(`/internal/threads/${recorded.threadId}`)
      .set(operator)
      .expect(200);
    expect(view.body.fields).toEqual([
      {
        key: "interest",
        name: "Interés",
        required: true,
        value: "2 dormitorios",
      },
      {
        key: "budget",
        name: "Presupuesto",
        required: true,
        value: "USD 150.000",
      },
      {
        key: "knowsProjects",
        name: "Conoce los proyectos",
        required: true,
        value: "No",
      },
    ]);
  });
});
