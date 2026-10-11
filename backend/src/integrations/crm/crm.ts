export type CrmLead = {
  /** E.164. */
  phone: string;
  name: string | null;
  email: string | null;
  /** Known CRM id (from a form payload or an earlier sync). Skips the phone search. */
  existingContactId: string | null;
  /** Summary and transcript written to the configured long-text property. */
  summary: string;
};

export type Crm = {
  readonly kind: "hubspot" | "fake";
  upsertLead(lead: CrmLead): Promise<{ contactId: string }>;
};

export class FakeCrm implements Crm {
  readonly kind = "fake" as const;
  readonly contacts = new Map<string, { id: string; lead: CrmLead }>();

  async upsertLead(lead: CrmLead) {
    const existing = this.contacts.get(lead.phone);
    const id = existing?.id ?? lead.existingContactId ?? `fake-contact-${this.contacts.size + 1}`;
    this.contacts.set(lead.phone, { id, lead });
    return { contactId: id };
  }
}
