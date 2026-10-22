import { readFileSync } from "node:fs";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { upgradeLegacyConfig } from "../../src/companies/company-config.js";
import {
  baseConfig,
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

const db = testDb();
const MIGRATION = readFileSync(
  new URL(
    "../../prisma/migrations/20261022090000_assistant_and_company_names/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

const { assistantName: _assistantName, ...withoutNames } = baseConfig;

class Rollback extends Error {}

/** Runs the migration's config function on each value, in a transaction that is rolled back. */
async function splitInSql(
  cases: Array<[config: unknown, companyName: string]>,
): Promise<unknown[]> {
  const fn = MIGRATION.slice(
    MIGRATION.indexOf("CREATE FUNCTION"),
    MIGRATION.indexOf("LANGUAGE plpgsql IMMUTABLE;") +
      "LANGUAGE plpgsql IMMUTABLE;".length,
  ).replace(
    'CREATE FUNCTION "leadscope_split_names"',
    "CREATE FUNCTION pg_temp.leadscope_split_names",
  );
  let results: unknown[] = [];
  await db
    .$transaction(async (tx) => {
      await tx.$executeRawUnsafe(fn);
      for (const [config, companyName] of cases)
        results.push(
          (
            await tx.$queryRawUnsafe<Array<{ upgraded: unknown }>>(
              "SELECT pg_temp.leadscope_split_names($1::jsonb, $2) AS upgraded",
              JSON.stringify(config),
              companyName,
            )
          )[0]!.upgraded,
        );
      throw new Rollback();
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) {
        results = [];
        throw error;
      }
    });
  return results;
}

describe("the names migration SQL", () => {
  it("keeps a display name that was the assistant's, drops one that repeated the company's, like the app", async () => {
    const cases: Array<[unknown, string]> = [
      [{ ...withoutNames, displayName: "Almira" }, "Altamira"],
      [{ ...withoutNames, displayName: " costa sur " }, "Costa Sur"],
      [{ ...withoutNames, displayName: "Vieja", assistantName: "Almira" }, "X"],
      [{ ...withoutNames, assistantName: "Almira" }, "Altamira"],
    ];
    const upgraded = await splitInSql(cases);
    expect(upgraded).toEqual(
      cases.map(([config, name]) =>
        JSON.parse(JSON.stringify(upgradeLegacyConfig(config, name))),
      ),
    );
    expect(
      upgraded.map(
        (config) => (config as { assistantName: string }).assistantName,
      ),
    ).toEqual(["Almira", "", "Almira", "Almira"]);
    for (const config of upgraded)
      expect(config).not.toHaveProperty("displayName");
  });
});

describe("a company whose config still has a display name", () => {
  const operator = { Authorization: "Bearer dev:operador@altamira.uy" };
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    await resetDb();
    const { id } = await createCompany(db, {
      slug: "altamira",
      name: "Altamira",
    });
    await db.company.update({
      where: { id },
      data: { config: { ...withoutNames, displayName: "Altamira" } },
    });
    await db.operator.create({
      data: { email: "operador@altamira.uy", companyId: id },
    });
    app = createApp(createTestContext());
  });

  it("reads it as the company's name, not the assistant's, and saves back without it", async () => {
    const settings = await request(app)
      .get("/internal/settings")
      .set(operator)
      .expect(200);
    expect(settings.body.config.assistantName).toBe("");
    expect(settings.body.config).not.toHaveProperty("displayName");
    expect(settings.body.companyName).toBe("Altamira");
    expect(settings.body.platformRules).toContain(
      "You are the WhatsApp virtual assistant of Altamira.",
    );

    await request(app)
      .put("/internal/settings/config")
      .set(operator)
      .send({ ...settings.body.config, assistantName: "Almira" })
      .expect(200);
    const row = await db.company.findUniqueOrThrow({
      where: { slug: "altamira" },
    });
    expect(row.config).toMatchObject({ assistantName: "Almira" });
    expect(row.config).not.toHaveProperty("displayName");
  });
});
