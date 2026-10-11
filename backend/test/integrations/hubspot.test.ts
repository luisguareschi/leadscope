import { describe, expect, it, vi } from "vitest";
import { createHubSpotCrm, fitHubSpotText } from "../../src/integrations/crm/hubspot.js";

type Call = { method: string; path: string; body: Record<string, unknown> | undefined };

function fakeHubSpot(responses: Array<{ status?: number; json: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({
      method: init?.method ?? "GET",
      path: String(url).replace("https://api.hubapi.com", ""),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses.shift() ?? { json: {} };
    return Response.json(next.json, { status: next.status ?? 200 });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const lead = { phone: "+59899111222", name: "Ana María", email: "ana@example.com", existingContactId: null, summary: "Resumen" };

describe("HubSpot CRM", () => {
  it("creates the contact with the summary when the phone is new", async () => {
    const { calls, fetchImpl } = fakeHubSpot([{ json: { results: [] } }, { json: { id: "501" } }]);
    const crm = createHubSpotCrm({ accessToken: "pat", transcriptProperty: "leadscope_resumen", fetchImpl });
    await expect(crm.upsertLead(lead)).resolves.toEqual({ contactId: "501" });
    expect(calls[0]?.path).toBe("/crm/v3/objects/contacts/search");
    expect(JSON.stringify(calls[0]?.body)).toContain('"value":"99111222"');
    expect(calls[1]).toEqual({
      method: "POST",
      path: "/crm/v3/objects/contacts",
      body: {
        properties: { phone: "+59899111222", firstname: "Ana", email: "ana@example.com", leadscope_resumen: "Resumen" },
      },
    });
  });

  it("updates the summary on the contact found by phone without overwriting its data", async () => {
    const { calls, fetchImpl } = fakeHubSpot([
      { json: { results: [{ id: "77", properties: { firstname: "Ana", email: "otra@example.com", phone: "+598 99 111 222" } }] } },
      { json: {} },
    ]);
    const crm = createHubSpotCrm({ accessToken: "pat", transcriptProperty: "leadscope_resumen", fetchImpl });
    await expect(crm.upsertLead(lead)).resolves.toEqual({ contactId: "77" });
    expect(calls[1]).toEqual({
      method: "PATCH",
      path: "/crm/v3/objects/contacts/77",
      body: { properties: { leadscope_resumen: "Resumen" } },
    });
  });

  it("goes straight to the contact id a form already gave", async () => {
    const { calls, fetchImpl } = fakeHubSpot([{ json: {} }]);
    const crm = createHubSpotCrm({ accessToken: "pat", transcriptProperty: "leadscope_resumen", fetchImpl });
    await crm.upsertLead({ ...lead, existingContactId: "900" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe("/crm/v3/objects/contacts/900");
  });

  it("updates the existing contact HubSpot names when the email already exists", async () => {
    const { calls, fetchImpl } = fakeHubSpot([
      { json: { results: [] } },
      { status: 409, json: { message: "Contact already exists. Existing ID: 1234" } },
      { json: {} },
    ]);
    const crm = createHubSpotCrm({ accessToken: "pat", transcriptProperty: "leadscope_resumen", fetchImpl });
    await expect(crm.upsertLead(lead)).resolves.toEqual({ contactId: "1234" });
    expect(calls[2]?.path).toBe("/crm/v3/objects/contacts/1234");
  });

  it("does not invent a property while the transcript property is not configured", async () => {
    const { calls, fetchImpl } = fakeHubSpot([{ json: { results: [] } }, { json: { id: "1" } }]);
    const crm = createHubSpotCrm({ accessToken: "pat", transcriptProperty: "", fetchImpl });
    await crm.upsertLead(lead);
    expect(calls[1]?.body).toEqual({ properties: { phone: "+59899111222", firstname: "Ana", email: "ana@example.com" } });
  });

  it("surfaces HubSpot errors", async () => {
    const { fetchImpl } = fakeHubSpot([{ status: 401, json: { message: "Authentication credentials not found" } }]);
    const crm = createHubSpotCrm({ accessToken: "bad", transcriptProperty: "", fetchImpl });
    await expect(crm.upsertLead(lead)).rejects.toThrow("Authentication credentials not found");
  });
});

describe("fitHubSpotText", () => {
  it("keeps the header and the latest part of a long transcript", () => {
    const text = `HEADER\n${"x".repeat(1000)}\nLAST LINE`;
    const fitted = fitHubSpotText(text, 200);
    expect(fitted.length).toBeLessThanOrEqual(200);
    expect(fitted.startsWith("HEADER")).toBe(true);
    expect(fitted.endsWith("LAST LINE")).toBe(true);
  });
});
