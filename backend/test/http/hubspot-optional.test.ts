import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { encryptSecrets } from "../../src/companies/company-secrets.js";
import { backfillHubspotEnabled } from "../../src/companies/load-company.js";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { sweepOnce } from "../../src/conversation/sweeper.js";
import { parseEncryptionKey } from "../../src/lib/crypto.js";
import {
  createCompany,
  createTestContext,
  inbound,
  resetDb,
  settle,
  testDb,
  type TestContext,
} from "../support/harness.js";
import { TEST_ENCRYPTION_KEY } from "../support/test-env.js";

const db = testDb();
const operator = { Authorization: "Bearer dev:operador@altamira.uy" };
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;
let pnid: string;

async function setup(hubspotEnabled: boolean) {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    hubspotEnabled,
  });
  companyId = company.id;
  pnid = company.whatsappPhoneNumberId!;
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId },
  });
  ctx = createTestContext({
    env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" },
  });
  app = createApp(ctx);
}

async function receive(body: string) {
  const result = await recordInboundMessage(ctx, inbound(pnid, { body }));
  if (result.status !== "recorded") throw new Error(result.status);
  await settle(ctx);
  return db.thread.findUniqueOrThrow({ where: { id: result.threadId } });
}

afterEach(() => settle(ctx));

describe("HubSpot off", () => {
  beforeEach(() => setup(false));

  it("creates no contact and queues nothing for a lead's messages", async () => {
    const thread = await receive("Hola, busco un 2 dormitorios");
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(0);
    expect(thread).toMatchObject({
      crmPendingAction: null,
      crmContactId: null,
      crmSyncedAt: null,
    });
  });

  it("queues nothing when a person changes the stage", async () => {
    const thread = await receive("Hola");
    await request(app)
      .post(`/internal/threads/${thread.id}/stage`)
      .set(operator)
      .send({ stage: "contacted" })
      .expect(200);
    await settle(ctx);
    const saved = await db.thread.findUniqueOrThrow({
      where: { id: thread.id },
    });
    expect(saved.stage).toBe("contacted");
    expect(saved.crmPendingAction).toBeNull();
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(0);
  });

  it("queues nothing for a form lead", async () => {
    await request(app)
      .post("/hooks/crm/form-lead/altamira")
      .set("X-LeadScope-Secret", "form-secret")
      .send({ phone: "099 111 333", firstname: "Eva" })
      .expect(200);
    await settle(ctx);
    const thread = await db.thread.findFirstOrThrow();
    expect(thread.crmPendingAction).toBeNull();
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(0);
  });

  it("hides the HubSpot status in the list and the thread", async () => {
    const thread = await receive("Hola");
    const list = await request(app)
      .get("/internal/threads")
      .set(operator)
      .expect(200);
    expect(list.body.threads[0].crm).toBeNull();
    const detail = await request(app)
      .get(`/internal/threads/${thread.id}`)
      .set(operator)
      .expect(200);
    expect(detail.body.thread.crm).toBeNull();
  });

  it("does not retry a write left from before it was turned off", async () => {
    const thread = await receive("Hola");
    await db.thread.update({
      where: { id: thread.id },
      data: { crmPendingAction: "update", crmLastError: "boom" },
    });
    expect((await sweepOnce(ctx)).crmRetried).toBe(0);
    await request(app)
      .post(`/internal/threads/${thread.id}/crm-sync`)
      .set(operator)
      .expect(400);
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(0);
  });
});

describe("turning HubSpot on and off", () => {
  beforeEach(() => setup(false));

  it("creates the contact on the lead's next message, with no backfill", async () => {
    const before = await receive("Hola");
    const switched = await request(app)
      .put("/internal/integrations/hubspot")
      .set(operator)
      .send({ enabled: true })
      .expect(200);
    expect(switched.body.hubspot.enabled).toBe(true);
    await settle(ctx);
    expect(ctx.integrations.fakes.crm.contacts.size).toBe(0);
    expect(
      (await db.thread.findUniqueOrThrow({ where: { id: before.id } }))
        .crmPendingAction,
    ).toBeNull();

    const after = await receive("¿Tienen algo en Pocitos?");
    expect(after.crmContactId).toBe("fake-contact-1");
    expect(after.crmSyncedAt).not.toBeNull();
  });

  it("drops pending writes when it is turned off", async () => {
    await db.company.update({
      where: { id: companyId },
      data: { hubspotEnabled: true },
    });
    const thread = await receive("Hola");
    await db.thread.update({
      where: { id: thread.id },
      data: {
        crmPendingAction: "handoff",
        crmAttempts: 3,
        crmLastError: "HubSpot returned 500",
      },
    });
    await request(app)
      .put("/internal/integrations/hubspot")
      .set(operator)
      .send({ enabled: false })
      .expect(200);
    expect(
      await db.thread.findUniqueOrThrow({ where: { id: thread.id } }),
    ).toMatchObject({
      crmPendingAction: null,
      crmAttempts: 0,
      crmLastError: null,
      crmNextAttemptAt: null,
    });
    const settings = await request(app)
      .get("/internal/settings")
      .set(operator)
      .expect(200);
    expect(settings.body.hubspot.enabled).toBe(false);
  });

  it("rejects anything but a boolean", async () => {
    await request(app)
      .put("/internal/integrations/hubspot")
      .set(operator)
      .send({ enabled: "yes" })
      .expect(400);
  });
});

describe("HubSpot defaults", () => {
  const key = parseEncryptionKey(TEST_ENCRYPTION_KEY);
  const silent = { error: vi.fn() };

  beforeEach(async () => {
    silent.error.mockClear();
    await resetDb();
  });

  it("turns on companies from before the switch only when they have a token", async () => {
    const withToken = await createCompany(db, {
      slug: "con-token",
      hubspotEnabled: null,
      secrets: { hubspotAccessToken: "pat-na1-xyz" },
    });
    const withoutToken = await createCompany(db, {
      slug: "sin-token",
      hubspotEnabled: null,
      secrets: { anthropicApiKey: "sk-ant-x" },
    });
    const chosen = await createCompany(db, {
      slug: "apagada",
      hubspotEnabled: false,
      secrets: { hubspotAccessToken: "pat-na1-abc" },
    });
    await db.company.create({
      data: {
        slug: "sin-secretos",
        name: "Sin secretos",
        config: {},
        encryptedSecrets: null,
      },
    });

    expect(await backfillHubspotEnabled(db, key, silent)).toBe(3);
    const enabled = async (id: string) =>
      (await db.company.findUniqueOrThrow({ where: { id } })).hubspotEnabled;
    expect(await enabled(withToken.id)).toBe(true);
    expect(await enabled(withoutToken.id)).toBe(false);
    expect(await enabled(chosen.id)).toBe(false);
    expect(
      (await db.company.findUniqueOrThrow({ where: { slug: "sin-secretos" } }))
        .hubspotEnabled,
    ).toBe(false);
    expect(await backfillHubspotEnabled(db, key, silent)).toBe(0);
  });

  it("skips a company whose secrets cannot be decrypted and still decides the rest", async () => {
    const broken = await db.company.create({
      data: {
        slug: "rota",
        name: "Rota",
        config: {},
        encryptedSecrets: encryptSecrets(
          { hubspotAccessToken: "pat" },
          parseEncryptionKey(Buffer.alloc(32, 9).toString("base64")),
        ),
      },
    });
    const fine = await createCompany(db, {
      slug: "bien",
      hubspotEnabled: null,
      secrets: { hubspotAccessToken: "pat-na1-xyz" },
    });

    expect(await backfillHubspotEnabled(db, key, silent)).toBe(1);
    expect(
      (await db.company.findUniqueOrThrow({ where: { id: broken.id } }))
        .hubspotEnabled,
    ).toBeNull();
    expect(
      (await db.company.findUniqueOrThrow({ where: { id: fine.id } }))
        .hubspotEnabled,
    ).toBe(true);
    expect(silent.error).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: broken.id }),
      expect.any(String),
    );
  });

  it("leaves the migration's null column for the backfill", async () => {
    const company = await db.company.create({
      data: {
        slug: "vieja",
        name: "Vieja",
        config: {},
        encryptedSecrets: encryptSecrets({ hubspotAccessToken: "pat" }, key),
      },
    });
    expect(company.hubspotEnabled).toBeNull();
  });

  it("creates new companies with HubSpot off", async () => {
    await setup(false);
    await request(app)
      .post("/internal/companies")
      .set({ Authorization: "Bearer dev:admin@example.com" })
      .send({ name: "Costa Sur", slug: "costa-sur", operatorEmail: "o@cs.uy" })
      .expect(201);
    const created = await db.company.findUniqueOrThrow({
      where: { slug: "costa-sur" },
    });
    expect(created.hubspotEnabled).toBe(false);
  });
});

describe("Abrir en HubSpot", () => {
  beforeEach(() => setup(true));

  it("links the thread's contact once the account is known", async () => {
    const thread = await receive("Hola");
    const read = () =>
      request(app)
        .get(`/internal/threads/${thread.id}`)
        .set(operator)
        .expect(200);
    await db.thread.update({
      where: { id: thread.id },
      data: { crmContactId: "51" },
    });
    expect((await read()).body.thread.crm.url).toBeNull();

    await db.company.update({
      where: { id: companyId },
      data: {
        hubspotPortalId: "146221212",
        hubspotUiDomain: "app-eu1.hubspot.com",
      },
    });
    expect((await read()).body.thread.crm).toMatchObject({
      status: "synced",
      contactId: "51",
      url: "https://app-eu1.hubspot.com/contacts/146221212/record/0-1/51",
    });
  });
});
