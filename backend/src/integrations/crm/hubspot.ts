import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import type { Crm, CrmLead } from "./crm.js";

const API = "https://api.hubapi.com";
/** HubSpot multi-line text properties hold up to 65,536 characters. */
export const HUBSPOT_TEXT_LIMIT = 65_000;

export class HubSpotError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type HubSpotOptions = {
  accessToken: string;
  /** Internal name of the long-text property. Empty: the contact is upserted without the summary. */
  transcriptProperty: string;
  fetchImpl?: typeof fetch;
};

type ContactResult = { id: string; properties: Record<string, string | null> };

/** Keeps the summary header and the most recent part of the transcript when it is too long. */
export function fitHubSpotText(text: string, limit = HUBSPOT_TEXT_LIMIT): string {
  if (text.length <= limit) return text;
  const marker = "\n[…conversación recortada…]\n";
  const head = text.slice(0, Math.floor(limit * 0.2));
  const tail = text.slice(text.length - (limit - head.length - marker.length));
  return `${head}${marker}${tail}`;
}

function firstName(name: string | null): string | null {
  return name?.trim().split(/\s+/)[0] ?? null;
}

export function createHubSpotCrm(options: HubSpotOptions): Crm {
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${options.accessToken}`, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await response.json().catch(() => ({}))) as T & { message?: string };
    if (!response.ok) throw new HubSpotError(json.message ?? `HubSpot returned ${response.status}`, response.status);
    return json;
  }

  async function findByPhone(phone: string): Promise<ContactResult | null> {
    const national = parsePhoneNumberFromString(phone)?.nationalNumber;
    const filterGroups = [
      { filters: [{ propertyName: "phone", operator: "EQ", value: phone }] },
      { filters: [{ propertyName: "mobilephone", operator: "EQ", value: phone }] },
      ...(national
        ? [{ filters: [{ propertyName: "hs_searchable_calculated_phone_number", operator: "EQ", value: national }] }]
        : []),
    ];
    const result = await request<{ results: ContactResult[] }>("POST", "/crm/v3/objects/contacts/search", {
      filterGroups,
      properties: ["firstname", "email", "phone"],
      limit: 1,
    });
    return result.results[0] ?? null;
  }

  function summaryProperties(summary: string): Record<string, string> {
    return options.transcriptProperty ? { [options.transcriptProperty]: fitHubSpotText(summary) } : {};
  }

  async function update(contactId: string, lead: CrmLead, current: ContactResult["properties"] | null) {
    const properties: Record<string, string> = { ...summaryProperties(lead.summary) };
    if (current && !current.phone) properties.phone = lead.phone;
    if (current && !current.firstname && firstName(lead.name)) properties.firstname = firstName(lead.name)!;
    if (current && !current.email && lead.email) properties.email = lead.email;
    if (Object.keys(properties).length > 0) {
      await request("PATCH", `/crm/v3/objects/contacts/${contactId}`, { properties });
    }
    return { contactId };
  }

  return {
    kind: "hubspot",
    async upsertLead(lead) {
      if (lead.existingContactId) return update(lead.existingContactId, lead, null);

      const existing = await findByPhone(lead.phone);
      if (existing) return update(existing.id, lead, existing.properties);

      const properties: Record<string, string> = { phone: lead.phone, ...summaryProperties(lead.summary) };
      const name = firstName(lead.name);
      if (name) properties.firstname = name;
      if (lead.email) properties.email = lead.email;
      try {
        const created = await request<{ id: string }>("POST", "/crm/v3/objects/contacts", { properties });
        return { contactId: created.id };
      } catch (error) {
        // A contact with the form's email already exists: HubSpot names it in the error.
        const existingId = error instanceof HubSpotError && error.status === 409 ? /ID:\s*(\d+)/.exec(error.message)?.[1] : null;
        if (existingId) return update(existingId, lead, null);
        throw error;
      }
    },
  };
}
