import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import {
  decryptSecrets,
  legacySecretsIn,
} from "../../src/companies/company-secrets.js";
import { loadCompanyById } from "../../src/companies/load-company.js";
import { encrypt, parseEncryptionKey } from "../../src/lib/crypto.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
  type TestContext,
} from "../support/harness.js";
import {
  kapsoMessageReceived,
  postKapsoWebhook,
} from "../support/kapso-webhooks.js";
import { TEST_ENCRYPTION_KEY } from "../support/test-env.js";

const db = testDb();
const key = parseEncryptionKey(TEST_ENCRYPTION_KEY);
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;

const operator = { Authorization: "Bearer dev:operador@altamira.uy" };

/** A company saved before the move to Kapso: its blob still carries the Meta access token. */
beforeEach(async () => {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    phoneNumberId: "123456789012345",
  });
  companyId = company.id;
  await db.company.update({
    where: { id: companyId },
    data: {
      encryptedSecrets: encrypt(
        JSON.stringify({
          anthropicApiKey: "sk-ant-kept-1111",
          metaAccessToken: "EAAG-old-meta-token-9999",
          hubspotAccessToken: "pat-kept-2222",
          formLeadSecret: "form-secret",
        }),
        key,
      ),
    },
  });
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId },
  });
  ctx = createTestContext();
  app = createApp(ctx);
});

afterEach(() => ctx.replies.drain());

describe("companies saved before Kapso", () => {
  it("still load, keep their other secrets and number, and drop the Meta token from the panel", async () => {
    expect(
      legacySecretsIn(
        (await db.company.findUniqueOrThrow({ where: { id: companyId } }))
          .encryptedSecrets,
        key,
      ),
    ).toEqual(["metaAccessToken"]);
    const loaded = await loadCompanyById(db, companyId, key);
    expect(loaded.whatsappPhoneNumberId).toBe("123456789012345");
    expect(loaded.secrets).toEqual({
      anthropicApiKey: "sk-ant-kept-1111",
      hubspotAccessToken: "pat-kept-2222",
      formLeadSecret: "form-secret",
    });

    const listed = await request(app)
      .get("/internal/secrets")
      .set(operator)
      .expect(200);
    expect(listed.body.secrets.map((s: { name: string }) => s.name)).toEqual([
      "anthropicApiKey",
      "kapsoApiKey",
      "kapsoWebhookSecret",
      "hubspotAccessToken",
      "formLeadSecret",
    ]);
    expect(JSON.stringify(listed.body)).not.toContain("9999");

    const settings = await request(app)
      .get("/internal/settings")
      .set(operator)
      .expect(200);
    expect(settings.body.whatsappPhoneNumberId).toBe("123456789012345");
    expect(settings.body.kapsoWebhookPath).toBe("/webhooks/kapso/altamira");

    await request(app)
      .post("/hooks/crm/form-lead/altamira")
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "099 111 222" })
      .expect(200);
  });

  it("start receiving on Kapso once the webhook secret is saved, and the save drops the Meta token", async () => {
    const message = kapsoMessageReceived({ phoneNumberId: "123456789012345" });
    await postKapsoWebhook(app, "altamira", message, {
      secret: "kapso-hook-secret",
    }).expect(401);

    await request(app)
      .put("/internal/secrets/kapsoWebhookSecret")
      .set(operator)
      .send({ value: "kapso-hook-secret" })
      .expect(200);
    const row = await db.company.findUniqueOrThrow({
      where: { id: companyId },
    });
    expect(legacySecretsIn(row.encryptedSecrets, key)).toEqual([]);
    expect(decryptSecrets(row.encryptedSecrets, key)).toEqual({
      anthropicApiKey: "sk-ant-kept-1111",
      kapsoWebhookSecret: "kapso-hook-secret",
      hubspotAccessToken: "pat-kept-2222",
      formLeadSecret: "form-secret",
    });

    await postKapsoWebhook(app, "altamira", message, {
      secret: "kapso-hook-secret",
    }).expect(200);
    await ctx.replies.drain();
    expect(
      await db.message.count({ where: { companyId, direction: "inbound" } }),
    ).toBe(1);
    expect(ctx.integrations.fakes.channel.sent).toHaveLength(1);
  });
});
