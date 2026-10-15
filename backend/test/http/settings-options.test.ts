import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { editableConfigSchema } from "../../src/companies/editable-config.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

const db = testDb();
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  await resetDb();
  const company = await createCompany(db, { slug: "altamira" });
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId: company.id },
  });
  app = createApp(createTestContext());
});

type Option = { value: string; label: string };

describe("settings options", () => {
  it("lists languages, IANA zones, countries with calling codes, and the fixed model list without a key", async () => {
    const response = await request(app)
      .get("/internal/settings/options")
      .set({ Authorization: "Bearer dev:operador@altamira.uy" })
      .expect(200);
    const { languages, timezones, countries, models } = response.body as {
      languages: Option[];
      timezones: Option[];
      countries: Array<Option & { callingCode: string }>;
      models: { source: string; options: Option[] };
    };

    expect(languages).toContainEqual({
      value: "es-UY",
      label: "Español (Uruguay)",
    });
    expect(timezones.map((zone) => zone.value)).toContain("America/Montevideo");
    expect(
      timezones.find((zone) => zone.value === "America/Montevideo")?.label,
    ).toBe("America/Montevideo (UTC-3)");
    expect(countries).toContainEqual({
      value: "UY",
      label: "Uruguay",
      callingCode: "598",
    });
    expect(models.source).toBe("fallback");
    expect(models.options.map((model) => model.value)).toEqual(
      expect.arrayContaining(["claude-haiku-4-5", "claude-sonnet-5-5"]),
    );

    const shape = editableConfigSchema.shape;
    for (const { value } of languages)
      expect(shape.language.safeParse(value).success).toBe(true);
    for (const { value } of timezones)
      expect(shape.timezone.safeParse(value).success).toBe(true);
    for (const { value } of countries)
      expect(shape.defaultCountry.safeParse(value).success).toBe(true);
    for (const { value } of models.options)
      expect(shape.llm.shape.model.safeParse(value).success).toBe(true);
  });

  it("is a company route", async () => {
    await request(app)
      .get("/internal/settings/options")
      .set({ Authorization: "Bearer dev:nadie@example.com" })
      .expect(403);
  });
});
