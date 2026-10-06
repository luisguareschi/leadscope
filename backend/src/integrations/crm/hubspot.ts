import { log } from "../../logger";
import { Crm, CrmUpsert, FakeCrm } from "./types";

const MAX_SUMMARY = 60_000;

type HubSpotResponse = { id?: string; results?: { id?: string }[] };

/**
 * Upserts a contact by E.164 phone and writes the transcript when a property name is configured.
 * Owner and task assignment are not set. That notification choice is still open.
 */
export class HubSpotCrm {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async upsertContact(token: string, input: CrmUpsert): Promise<{ contactId: string }> {
    const summary =
      input.summary.length > MAX_SUMMARY
        ? `${input.summary.slice(0, MAX_SUMMARY)}\n[truncated]`
        : input.summary;
    let id = input.existingContactId;
    if (!id) id = await this.searchPhone(token, input.phone);
    const properties: Record<string, string> = { phone: input.phone };
    if (input.email) properties.email = input.email;
    if (input.transcriptProperty) properties[input.transcriptProperty] = summary;
    else log.warn({ companyId: input.companyId }, "crm transcript property is not configured");

    if (id) {
      await this.request(token, `/crm/v3/objects/contacts/${id}`, "PATCH", { properties });
      return { contactId: id };
    }
    const created = await this.request(token, "/crm/v3/objects/contacts", "POST", { properties });
    return { contactId: String(created.id) };
  }

  private async searchPhone(token: string, phone: string): Promise<string | null> {
    for (const value of [phone, phone.replace(/^\+/, "")]) {
      const result = await this.request(token, "/crm/v3/objects/contacts/search", "POST", {
        filterGroups: [{ filters: [{ propertyName: "phone", operator: "EQ", value }] }],
        limit: 1,
      });
      const id = result.results?.[0]?.id;
      if (id) return String(id);
    }
    return null;
  }

  private async request(token: string, path: string, method: string, body: unknown): Promise<HubSpotResponse> {
    const response = await this.fetchImpl(`https://api.hubapi.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`hubspot ${method} ${path} failed (${response.status})`);
    return (await response.json()) as HubSpotResponse;
  }
}

export class RoutingCrm implements Crm {
  readonly fake = new FakeCrm();
  private readonly real = new HubSpotCrm();

  constructor(private readonly tokenFor: (companyId: string) => Promise<string>) {}

  async upsertContact(input: CrmUpsert): Promise<{ contactId: string }> {
    const token = await this.tokenFor(input.companyId);
    if (!token || token === "fake") return this.fake.upsertContact(input);
    return this.real.upsertContact(token, input);
  }
}
