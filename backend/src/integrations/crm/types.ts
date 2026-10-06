export type CrmUpsert = {
  companyId: string;
  phone: string;
  email: string | null;
  existingContactId: string | null;
  summary: string;
  /** Empty until the HubSpot internal name is known. The contact is still upserted. */
  transcriptProperty: string;
};

export interface Crm {
  upsertContact(input: CrmUpsert): Promise<{ contactId: string }>;
}

export class FakeCrm implements Crm {
  readonly contacts = new Map<string, CrmUpsert & { contactId: string }>();

  async upsertContact(input: CrmUpsert): Promise<{ contactId: string }> {
    const key = `${input.companyId}:${input.phone}`;
    const existing = this.contacts.get(key);
    const contactId = existing?.contactId ?? input.existingContactId ?? `fake-contact-${this.contacts.size + 1}`;
    this.contacts.set(key, { ...input, contactId });
    return { contactId };
  }
}
