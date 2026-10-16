import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { decryptSecrets } from "../../src/companies/company-secrets.js";
import { createApp } from "../../src/app.js";
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

const ownAuth = { Authorization: "Bearer dev:operador@test.com" };
const otherAuth = { Authorization: "Bearer dev:otra@test.com" };

const OWN_FORM = "form-secret-own-company-77xy";
const OTHER_ANTHROPIC = "sk-ant-other-company-zz99";
const OTHER_FORM = "form-secret-other-company-qq11";

beforeEach(async () => {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    secrets: { formLeadSecret: OWN_FORM },
  });
  const other = await createCompany(db, {
    slug: "otra",
    secrets: { anthropicApiKey: OTHER_ANTHROPIC, formLeadSecret: OTHER_FORM },
  });
  await db.operator.create({
    data: { email: "operador@test.com", companyId: company.id },
  });
  await db.operator.create({
    data: { email: "otra@test.com", companyId: other.id },
  });
  app = createApp(createTestContext());
});

async function storedSecrets(slug: string) {
  const company = await db.company.findUniqueOrThrow({ where: { slug } });
  return {
    blob: company.encryptedSecrets,
    secrets: decryptSecrets(company.encryptedSecrets, key),
  };
}

describe("company secrets", () => {
  it("lets an operator set and replace their own key without returning the raw value", async () => {
    const first = "sk-ant-own-company-11aa";
    const created = await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(ownAuth)
      .send({ value: `  ${first}  ` })
      .expect(200);

    expect(created.body).toEqual({
      secret: { name: "anthropicApiKey", set: true, last4: "11aa" },
    });
    expect(JSON.stringify(created.body)).not.toContain(first);
    expect(Object.keys(created.body.secret).sort()).toEqual([
      "last4",
      "name",
      "set",
    ]);

    let own = await storedSecrets("altamira");
    expect(own.secrets.anthropicApiKey).toBe(first);
    expect(own.secrets.formLeadSecret).toBe(OWN_FORM);
    expect(own.blob).not.toContain(first);

    const second = "sk-ant-own-company-22bb";
    const replaced = await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(ownAuth)
      .send({ value: second })
      .expect(200);
    expect(replaced.body.secret).toEqual({
      name: "anthropicApiKey",
      set: true,
      last4: "22bb",
    });
    expect(JSON.stringify(replaced.body)).not.toContain(second);
    expect(JSON.stringify(replaced.body)).not.toContain(first);

    own = await storedSecrets("altamira");
    expect(own.secrets.anthropicApiKey).toBe(second);
    expect(own.secrets.formLeadSecret).toBe(OWN_FORM);
    expect(own.blob).not.toContain(second);

    const listed = await request(app)
      .get("/internal/secrets")
      .set(ownAuth)
      .expect(200);
    expect(listed.body.secrets).toEqual([
      { name: "anthropicApiKey", set: true, last4: "22bb" },
      { name: "kapsoApiKey", set: false, last4: null },
      { name: "kapsoWebhookSecret", set: false, last4: null },
      { name: "hubspotAccessToken", set: false, last4: null },
      { name: "formLeadSecret", set: true, last4: "77xy" },
    ]);
    const listedJson = JSON.stringify(listed.body);
    expect(listedJson).not.toContain(second);
    expect(listedJson).not.toContain(OWN_FORM);
    expect(listedJson).not.toContain(OTHER_ANTHROPIC);
  });

  it("does not reveal a secret short enough that the last 4 would be the whole value", async () => {
    const short = "ab12";
    const saved = await request(app)
      .put("/internal/secrets/kapsoWebhookSecret")
      .set(ownAuth)
      .send({ value: short })
      .expect(200);
    expect(saved.body.secret).toEqual({
      name: "kapsoWebhookSecret",
      set: true,
      last4: null,
    });
    expect(JSON.stringify(saved.body)).not.toContain(short);

    const listed = await request(app)
      .get("/internal/secrets")
      .set(ownAuth)
      .expect(200);
    expect(
      listed.body.secrets.find(
        (secret: { name: string }) => secret.name === "kapsoWebhookSecret",
      ),
    ).toEqual({
      name: "kapsoWebhookSecret",
      set: true,
      last4: null,
    });
    expect(JSON.stringify(listed.body)).not.toContain(short);
  });

  it("rejects an empty value and leaves the stored secret in place", async () => {
    await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(ownAuth)
      .send({ value: "sk-ant-keep-me-99zz" })
      .expect(200);

    const blank = await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(ownAuth)
      .send({ value: "   " })
      .expect(400);
    expect(blank.body.error.code).toBe("invalid_input");
    const missing = await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(ownAuth)
      .send({})
      .expect(400);
    expect(missing.body.error.code).toBe("invalid_input");

    const own = await storedSecrets("altamira");
    expect(own.secrets.anthropicApiKey).toBe("sk-ant-keep-me-99zz");
  });

  it("clears one secret only when asked, and leaves the others", async () => {
    await request(app)
      .put("/internal/secrets/hubspotAccessToken")
      .set(ownAuth)
      .send({ value: "pat-own-hubspot-55kk" })
      .expect(200);
    const cleared = await request(app)
      .delete("/internal/secrets/formLeadSecret")
      .set(ownAuth)
      .expect(200);
    expect(cleared.body.secret).toEqual({
      name: "formLeadSecret",
      set: false,
      last4: null,
    });

    const own = await storedSecrets("altamira");
    expect(own.secrets.formLeadSecret).toBeUndefined();
    expect(own.secrets.hubspotAccessToken).toBe("pat-own-hubspot-55kk");
  });

  it("cannot set or read another company's key", async () => {
    const otherBefore = await storedSecrets("otra");
    const sneaky = "sk-ant-sneaky-write-33cc";
    const other = await db.company.findUniqueOrThrow({
      where: { slug: "otra" },
    });

    const saved = await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .set(ownAuth)
      .send({ value: sneaky, companyId: other.id, slug: "otra" })
      .expect(200);
    expect(saved.body.secret.last4).toBe("33cc");
    expect(JSON.stringify(saved.body)).not.toContain(sneaky);

    const own = await storedSecrets("altamira");
    const otherAfter = await storedSecrets("otra");
    expect(own.secrets.anthropicApiKey).toBe(sneaky);
    expect(otherAfter.secrets).toEqual(otherBefore.secrets);
    expect(otherAfter.blob).toBe(otherBefore.blob);

    const asOther = await request(app)
      .get("/internal/secrets")
      .set(otherAuth)
      .expect(200);
    const otherJson = JSON.stringify(asOther.body);
    expect(otherJson).not.toContain(sneaky);
    expect(otherJson).not.toContain(OTHER_ANTHROPIC);
    expect(
      asOther.body.secrets.find(
        (secret: { name: string }) => secret.name === "anthropicApiKey",
      ).last4,
    ).toBe("zz99");

    await request(app)
      .delete("/internal/secrets/anthropicApiKey")
      .set(ownAuth)
      .expect(200);
    expect((await storedSecrets("otra")).secrets.anthropicApiKey).toBe(
      OTHER_ANTHROPIC,
    );
    expect(
      (await storedSecrets("altamira")).secrets.anthropicApiKey,
    ).toBeUndefined();
  });

  it("refuses a signed-out caller and an unknown secret name", async () => {
    await request(app).get("/internal/secrets").expect(401);
    await request(app)
      .put("/internal/secrets/anthropicApiKey")
      .send({ value: "sk-ant-nope" })
      .expect(401);
    const unknown = await request(app)
      .put("/internal/secrets/databaseUrl")
      .set(ownAuth)
      .send({ value: "nope" })
      .expect(400);
    expect(unknown.body.error.code).toBe("invalid_input");
    await request(app)
      .put("/internal/secrets/metaAccessToken")
      .set(ownAuth)
      .send({ value: "EAAG-old-meta-token" })
      .expect(400);
    expect((await storedSecrets("altamira")).secrets).toEqual({
      formLeadSecret: OWN_FORM,
    });
  });
});
