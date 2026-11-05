import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import type { CompanySecrets } from "../../src/companies/company-secrets.js";
import type { CompanyConfigInput } from "../../src/companies/company-config.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

const db = testDb();
const operator = { Authorization: "Bearer dev:operador@altamira.uy" };
type Route = (url: URL, init: RequestInit | undefined) => Response | undefined;

/** A fetch that answers from `route` and records every call, so a test can assert nothing was sent. */
function fakeFetch(route: Route) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    return (
      route(url, init) ??
      Response.json({ message: "not found" }, { status: 404 })
    );
  });
}

let companyId: string;

async function setup(options: {
  secrets?: CompanySecrets;
  config?: Partial<CompanyConfigInput>;
  hubspotFetch?: ReturnType<typeof fakeFetch>;
  anthropicFetch?: ReturnType<typeof fakeFetch>;
  kapsoFetch?: ReturnType<typeof fakeFetch>;
}) {
  await resetDb();
  const company = await createCompany(db, {
    slug: "altamira",
    phoneNumberId: "647015955153740",
    secrets: options.secrets ?? {},
    config: options.config,
  });
  companyId = company.id;
  await db.operator.create({
    data: { email: "operador@altamira.uy", companyId },
  });
  const unexpected = fakeFetch(() => {
    throw new Error("unexpected request");
  });
  return createApp(
    createTestContext({
      integrations: {
        hubspotFetch: (options.hubspotFetch ?? unexpected) as typeof fetch,
        anthropicFetch: (options.anthropicFetch ?? unexpected) as typeof fetch,
        kapsoFetch: (options.kapsoFetch ?? unexpected) as typeof fetch,
      },
    }),
  );
}

const statuses = (body: { checks: Array<{ id: string; status: string }> }) =>
  body.checks.map((check) => [check.id, check.status]);

function hubspotApi(
  options: {
    token?: string;
    scopes?: string[];
    property?: { type: string; fieldType: string } | null;
  } = {},
) {
  const token = options.token ?? "pat-eu1-good";
  return fakeFetch((url, init) => {
    const auth = new Headers(init?.headers).get("Authorization");
    if (auth !== `Bearer ${token}`)
      return Response.json(
        { message: "Authentication credentials not found" },
        { status: 401 },
      );
    if (url.pathname === "/account-info/v3/details")
      return Response.json({
        portalId: 146221212,
        portalName: "Altamira",
        uiDomain: "app-eu1.hubspot.com",
        dataHostingLocation: "eu1",
      });
    if (url.pathname === "/oauth/v2/private-apps/get/access-token-info") {
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({ tokenKey: token });
      return Response.json({
        userId: 1,
        hubId: 146221212,
        appId: 2,
        scopes: options.scopes ?? [
          "crm.objects.contacts.read",
          "crm.objects.contacts.write",
        ],
      });
    }
    if (url.pathname === "/crm/v3/properties/contacts/leadscope_resumen") {
      if (options.property === null) return undefined;
      return Response.json({
        name: "leadscope_resumen",
        label: "Resumen LeadScope",
        ...(options.property ?? { type: "string", fieldType: "textarea" }),
      });
    }
    return undefined;
  });
}

const withProperty = {
  crm: {
    provider: "hubspot" as const,
    transcriptProperty: "leadscope_resumen",
  },
};

describe("HubSpot check", () => {
  it("says the token is missing without calling HubSpot", async () => {
    const app = await setup({});
    const response = await request(app)
      .post("/internal/integrations/hubspot/check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(false);
    expect(statuses(response.body)).toEqual([
      ["enabled", "ok"],
      ["token", "error"],
    ]);
  });

  it("passes with a valid token, both scopes, and the property, and saves the account", async () => {
    const hubspotFetch = hubspotApi();
    const app = await setup({
      secrets: { hubspotAccessToken: "pat-eu1-good" },
      config: withProperty,
      hubspotFetch,
    });
    const response = await request(app)
      .post("/internal/integrations/hubspot/check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(true);
    expect(statuses(response.body)).toEqual([
      ["enabled", "ok"],
      ["token", "ok"],
      ["scopes", "ok"],
      ["property", "ok"],
    ]);
    expect(response.body.account).toEqual({
      portalId: "146221212",
      uiDomain: "app-eu1.hubspot.com",
    });
    expect(JSON.stringify(response.body)).not.toContain("pat-eu1-good");
    expect(
      await db.company.findUniqueOrThrow({ where: { id: companyId } }),
    ).toMatchObject({
      hubspotPortalId: "146221212",
      hubspotUiDomain: "app-eu1.hubspot.com",
    });
    // Reads only: the token-info lookup is HubSpot's one POST, and nothing is written.
    expect(
      hubspotFetch.mock.calls.map(([url, init]) => [
        init?.method,
        new URL(String(url)).pathname,
      ]),
    ).toEqual([
      ["GET", "/account-info/v3/details"],
      ["POST", "/oauth/v2/private-apps/get/access-token-info"],
      ["GET", "/crm/v3/properties/contacts/leadscope_resumen"],
    ]);
  });

  it("names the missing scope", async () => {
    const app = await setup({
      secrets: { hubspotAccessToken: "pat-eu1-good" },
      config: withProperty,
      hubspotFetch: hubspotApi({ scopes: ["crm.objects.contacts.read"] }),
    });
    const response = await request(app)
      .post("/internal/integrations/hubspot/check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(false);
    const scopes = response.body.checks.find(
      (check: { id: string }) => check.id === "scopes",
    );
    expect(scopes.status).toBe("error");
    expect(scopes.detail).toContain("crm.objects.contacts.write");
  });

  it("says when the property does not exist or is not text", async () => {
    let app = await setup({
      secrets: { hubspotAccessToken: "pat-eu1-good" },
      config: withProperty,
      hubspotFetch: hubspotApi({ property: null }),
    });
    let response = await request(app)
      .post("/internal/integrations/hubspot/check")
      .set(operator)
      .expect(200);
    let property = response.body.checks.at(-1);
    expect(property).toMatchObject({ id: "property", status: "error" });
    expect(property.detail).toContain("No existe");

    app = await setup({
      secrets: { hubspotAccessToken: "pat-eu1-good" },
      config: withProperty,
      hubspotFetch: hubspotApi({
        property: { type: "number", fieldType: "number" },
      }),
    });
    response = await request(app)
      .post("/internal/integrations/hubspot/check")
      .set(operator)
      .expect(200);
    property = response.body.checks.at(-1);
    expect(property).toMatchObject({ id: "property", status: "error" });
  });

  it("warns without a property but still passes", async () => {
    const app = await setup({
      secrets: { hubspotAccessToken: "pat-eu1-good" },
      hubspotFetch: hubspotApi(),
    });
    const response = await request(app)
      .post("/internal/integrations/hubspot/check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(true);
    expect(response.body.checks.at(-1)).toMatchObject({
      id: "property",
      status: "warning",
    });
  });

  it("explains a rejected token and skips the rest", async () => {
    const app = await setup({
      secrets: { hubspotAccessToken: "pat-eu1-revoked" },
      config: withProperty,
      hubspotFetch: hubspotApi(),
    });
    const response = await request(app)
      .post("/internal/integrations/hubspot/check")
      .set(operator)
      .expect(200);
    expect(statuses(response.body)).toEqual([
      ["enabled", "ok"],
      ["token", "error"],
      ["scopes", "skipped"],
      ["property", "skipped"],
    ]);
    expect(response.body.checks[1].detail).toContain("rechazó el token");
  });

  const storedAccount = {
    hubspotPortalId: "999",
    hubspotUiDomain: "app.hubspot.com",
  };
  const account = () =>
    db.company.findUniqueOrThrow({
      where: { id: companyId },
      select: { hubspotPortalId: true, hubspotUiDomain: true },
    });

  it("forgets the stored account when the test gets a 401, and keeps it on other failures", async () => {
    const failing = (status: number) =>
      fakeFetch(() => Response.json({ message: "nope" }, { status }));
    for (const [status, expected] of [
      [500, storedAccount],
      [429, storedAccount],
      [401, { hubspotPortalId: null, hubspotUiDomain: null }],
    ] as const) {
      const app = await setup({
        secrets: { hubspotAccessToken: "pat-eu1-good" },
        hubspotFetch: failing(status),
      });
      await db.company.update({
        where: { id: companyId },
        data: storedAccount,
      });
      await request(app)
        .post("/internal/integrations/hubspot/check")
        .set(operator)
        .expect(200);
      expect(await account()).toEqual(expected);
    }
  });

  it("keeps the stored account when saving a token hits a transient failure", async () => {
    for (const [response, expected] of [
      [() => Response.json({}, { status: 503 }), storedAccount],
      [() => Response.json({}, { status: 429 }), storedAccount],
      [
        () => {
          throw new TypeError("fetch failed");
        },
        storedAccount,
      ],
      [
        () => Response.json({}, { status: 401 }),
        { hubspotPortalId: null, hubspotUiDomain: null },
      ],
    ] as const) {
      const app = await setup({ hubspotFetch: fakeFetch(response) });
      await db.company.update({
        where: { id: companyId },
        data: storedAccount,
      });
      await request(app)
        .put("/internal/secrets/hubspotAccessToken")
        .set(operator)
        .send({ value: "pat-eu1-new" })
        .expect(200);
      expect(await account()).toEqual(expected);
    }
  });

  it("saves the account when the token is saved, and forgets it when removed", async () => {
    const app = await setup({ hubspotFetch: hubspotApi() });
    await request(app)
      .put("/internal/secrets/hubspotAccessToken")
      .set(operator)
      .send({ value: "pat-eu1-good" })
      .expect(200);
    const settings = await request(app)
      .get("/internal/settings")
      .set(operator)
      .expect(200);
    expect(settings.body.hubspot).toEqual({
      enabled: true,
      portalId: "146221212",
      uiDomain: "app-eu1.hubspot.com",
    });
    await request(app)
      .delete("/internal/secrets/hubspotAccessToken")
      .set(operator)
      .expect(200);
    expect(
      await db.company.findUniqueOrThrow({ where: { id: companyId } }),
    ).toMatchObject({ hubspotPortalId: null, hubspotUiDomain: null });
  });
});

function anthropicApi(models: Record<string, string>) {
  return fakeFetch((url, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    const key = new Headers(init?.headers).get("x-api-key");
    if (key !== "sk-ant-good")
      return Response.json(
        {
          type: "error",
          error: { type: "authentication_error", message: "invalid x-api-key" },
        },
        { status: 401 },
      );
    const id = decodeURIComponent(url.pathname.split("/").at(-1) ?? "");
    if (url.pathname.startsWith("/v1/models/") && models[id])
      return Response.json({
        type: "model",
        id: models[id],
        display_name: "Claude Haiku 4.5",
        created_at: "2025-10-01T00:00:00Z",
      });
    return Response.json(
      {
        type: "error",
        error: { type: "not_found_error", message: "model not found" },
      },
      { status: 404 },
    );
  });
}

describe("Anthropic check", () => {
  const models = { "claude-haiku-4-5": "claude-haiku-4-5-20251001" };

  it("checks the key and the saved model with the Models API only", async () => {
    const anthropicFetch = anthropicApi(models);
    const app = await setup({
      secrets: { anthropicApiKey: "sk-ant-good" },
      anthropicFetch,
    });
    const response = await request(app)
      .post("/internal/integrations/anthropic/check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(true);
    expect(statuses(response.body)).toEqual([
      ["apiKey", "ok"],
      ["model", "ok"],
    ]);
    expect(response.body.checks[1].detail).toContain("Claude Haiku 4.5");
    expect(anthropicFetch).toHaveBeenCalledTimes(1);
    expect(String(anthropicFetch.mock.calls[0]![0])).toContain(
      "/v1/models/claude-haiku-4-5",
    );
  });

  it("says when the key is wrong", async () => {
    const app = await setup({
      secrets: { anthropicApiKey: "sk-ant-bad" },
      anthropicFetch: anthropicApi(models),
    });
    const response = await request(app)
      .post("/internal/integrations/anthropic/check")
      .set(operator)
      .expect(200);
    expect(statuses(response.body)).toEqual([
      ["apiKey", "error"],
      ["model", "skipped"],
    ]);
  });

  it("says when the model does not exist for this key", async () => {
    const app = await setup({
      secrets: { anthropicApiKey: "sk-ant-good" },
      config: {
        llm: {
          model: "claude-imaginario-9",
          temperature: 0.4,
          historyLimit: 40,
          timeoutMs: 25_000,
        },
      },
      anthropicFetch: anthropicApi(models),
    });
    const response = await request(app)
      .post("/internal/integrations/anthropic/check")
      .set(operator)
      .expect(200);
    expect(statuses(response.body)).toEqual([
      ["apiKey", "ok"],
      ["model", "error"],
    ]);
    expect(response.body.checks[1].detail).toContain("claude-imaginario-9");
  });

  it("says the key is missing without calling Anthropic", async () => {
    const app = await setup({});
    const response = await request(app)
      .post("/internal/integrations/anthropic/check")
      .set(operator)
      .expect(200);
    expect(statuses(response.body)).toEqual([
      ["apiKey", "error"],
      ["model", "skipped"],
    ]);
  });
});

function kapsoApi(
  templates: Array<{ name: string; language: string; status: string }>,
) {
  return fakeFetch((url, init) => {
    expect(init?.method ?? "GET").toBe("GET");
    if (new Headers(init?.headers).get("X-API-Key") !== "kapso-key")
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    if (url.pathname === "/platform/v1/whatsapp/phone_numbers/647015955153740")
      return Response.json({
        data: {
          id: "647015955153740",
          phone_number_id: "647015955153740",
          business_account_id: "1029384756",
        },
      });
    if (url.pathname === "/meta/whatsapp/v24.0/1029384756/message_templates")
      return Response.json({
        data: templates.filter(
          (template) => template.name === url.searchParams.get("name"),
        ),
      });
    return undefined;
  });
}

describe("Formularios check", () => {
  const whatsapp = { kapsoApiKey: "kapso-key", formLeadSecret: "form-secret" };

  it("passes when the secret is set and the template is approved, sending nothing", async () => {
    const kapsoFetch = kapsoApi([
      { name: "bienvenida", language: "es", status: "APPROVED" },
    ]);
    const app = await setup({ secrets: whatsapp, kapsoFetch });
    const response = await request(app)
      .post("/internal/integrations/forms/check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(true);
    expect(response.body.formLeadPath).toBe("/hooks/crm/form-lead/altamira");
    expect(statuses(response.body)).toEqual([
      ["secret", "ok"],
      ["template", "ok"],
    ]);
    expect(kapsoFetch).toHaveBeenCalledTimes(2);
    expect(
      kapsoFetch.mock.calls.some(([url]) => String(url).includes("/messages")),
    ).toBe(false);
  });

  it("explains a template that is pending, missing, or in another language", async () => {
    const cases: Array<
      [Array<{ name: string; language: string; status: string }>, string]
    > = [
      [[{ name: "bienvenida", language: "es", status: "PENDING" }], "revisión"],
      [[], "No hay una plantilla bienvenida"],
      [
        [{ name: "bienvenida", language: "es_AR", status: "APPROVED" }],
        "es_AR",
      ],
    ];
    for (const [templates, expected] of cases) {
      const app = await setup({
        secrets: whatsapp,
        kapsoFetch: kapsoApi(templates),
      });
      const response = await request(app)
        .post("/internal/integrations/forms/check")
        .set(operator)
        .expect(200);
      expect(response.body.ready).toBe(false);
      const template = response.body.checks[1];
      expect(template.status).toBe("error");
      expect(template.detail).toContain(expected);
    }
  });

  it("says the secret is missing and skips the template without Kapso", async () => {
    const app = await setup({});
    const response = await request(app)
      .post("/internal/integrations/forms/check")
      .set(operator)
      .expect(200);
    expect(statuses(response.body)).toEqual([
      ["secret", "error"],
      ["template", "skipped"],
    ]);
  });

  it("warns when the welcome is off", async () => {
    const app = await setup({
      secrets: whatsapp,
      config: { whatsapp: { welcomeTemplate: null } },
    });
    const response = await request(app)
      .post("/internal/integrations/forms/check")
      .set(operator)
      .expect(200);
    expect(response.body.ready).toBe(true);
    expect(statuses(response.body)).toEqual([
      ["secret", "ok"],
      ["template", "warning"],
    ]);
  });
});
