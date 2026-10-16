import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { isAllowedPanelOrigin } from "../../src/http/panel-origin.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";
import { fakeSupabase } from "../support/fake-supabase.js";

const PRODUCTION = "https://leadscope-backoffice.onrender.com";
const PREVIEW = "https://leadscope-backoffice-pr-123.onrender.com";
const RENDER = {
  BACKOFFICE_ORIGIN: `${PRODUCTION},https://leadscope-backoffice-pr-*.onrender.com`,
};
const admin = { Authorization: "Bearer dev:admin@example.com" };

describe("BACKOFFICE_ORIGIN matching", () => {
  it("allows the production panel and pr-<n> previews", () => {
    expect(isAllowedPanelOrigin(RENDER, PRODUCTION)).toBe(true);
    expect(isAllowedPanelOrigin(RENDER, PREVIEW)).toBe(true);
  });

  it("refuses other sites, a wildcard across dots, and http", () => {
    for (const origin of [
      "https://evil.com",
      "https://leadscope-backoffice-pr-1.onrender.com.evil.com",
      "https://leadscope-backoffice-pr-1.evil.onrender.com",
      "https://other-app.onrender.com",
      "http://leadscope-backoffice-pr-1.onrender.com",
    ])
      expect(isAllowedPanelOrigin(RENDER, origin), origin).toBe(false);
  });

  it("ignores a bare or non-https wildcard", () => {
    for (const entry of [
      "*",
      "https://*",
      "https://*.onrender.com",
      "https://pr-*.com",
      "http://pr-*.onrender.com",
    ])
      expect(
        isAllowedPanelOrigin(
          { BACKOFFICE_ORIGIN: entry },
          "https://pr-1.onrender.com",
        ),
        entry,
      ).toBe(false);
  });
});

describe("panel origins", () => {
  let supabase: ReturnType<typeof fakeSupabase>;
  let app: ReturnType<typeof createApp>;
  let operatorsPath: string;

  const redirects = (path: "/invite" | "/recover") =>
    supabase.calls
      .filter((call) => call.path === path)
      .map((call) => call.query.get("redirect_to"));

  beforeEach(async () => {
    await resetDb();
    const company = await createCompany(testDb(), { slug: "otra" });
    operatorsPath = `/internal/companies/${company.id}/operators`;
    supabase = fakeSupabase();
    app = createApp(
      createTestContext({
        env: { ...RENDER, PLATFORM_ADMIN_EMAILS: "admin@example.com" },
        authAdmin: supabase.authAdmin,
      }),
    );
  });

  it("CORS echoes a listed origin and ignores others", async () => {
    const preflight = (origin: string) =>
      request(app)
        .options("/internal/me")
        .set("Origin", origin)
        .set("Access-Control-Request-Method", "GET");
    expect(
      (await preflight(PREVIEW)).headers["access-control-allow-origin"],
    ).toBe(PREVIEW);
    expect(
      (await preflight("https://evil.com")).headers[
        "access-control-allow-origin"
      ],
    ).toBeUndefined();
  });

  it("invitations point at the listed panel that sent the request, else the first exact entry", async () => {
    for (const [email, origin] of [
      ["preview@otra.uy", PREVIEW],
      ["evil@otra.uy", "https://evil.com"],
      ["none@otra.uy", undefined],
    ] as const) {
      const call = request(app).post(operatorsPath).set(admin);
      await (origin ? call.set("Origin", origin) : call)
        .send({ email })
        .expect(201);
    }
    await request(app)
      .post("/internal/companies")
      .set(admin)
      .set("Origin", PREVIEW)
      .send({ name: "Costa Sur", slug: "costa-sur", operatorEmail: "a@cs.uy" })
      .expect(201);
    expect(redirects("/invite")).toEqual([
      `${PREVIEW}/auth/set-password`,
      `${PRODUCTION}/auth/set-password`,
      `${PRODUCTION}/auth/set-password`,
      `${PREVIEW}/auth/set-password`,
    ]);
  });

  it("a resend's password-reset link follows the same rule", async () => {
    supabase.addConfirmedUser("con.clave@otra.uy");
    const added = await request(app)
      .post(operatorsPath)
      .set(admin)
      .send({ email: "con.clave@otra.uy" })
      .expect(201);
    const resend = `${operatorsPath}/${added.body.operator.id}/invite`;
    for (const origin of [PREVIEW, "https://evil.com"]) {
      const resent = await request(app)
        .post(resend)
        .set(admin)
        .set("Origin", origin)
        .expect(200);
      expect(resent.body.invite).toEqual({ status: "reset_sent" });
    }
    expect(redirects("/recover")).toEqual([
      `${PREVIEW}/auth/set-password`,
      `${PRODUCTION}/auth/set-password`,
    ]);
  });

  it("refuses to send an invitation when the list has no exact origin", async () => {
    app = createApp(
      createTestContext({
        env: {
          BACKOFFICE_ORIGIN: "*",
          PLATFORM_ADMIN_EMAILS: "admin@example.com",
        },
        authAdmin: supabase.authAdmin,
      }),
    );
    const refused = await request(app)
      .post(operatorsPath)
      .set(admin)
      .set("Origin", "https://evil.com")
      .send({ email: "x@otra.uy" })
      .expect(400);
    expect(refused.body.error.code).toBe("panel_origin_unknown");
    expect(supabase.calls).toEqual([]);
  });
});
