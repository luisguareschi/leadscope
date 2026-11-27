export type CrmLead = {
  /** E.164, or null for BSUID-only WhatsApp leads without a phone number. */
  phone: string | null;
  /** Meta Business-Scoped User ID (e.g. CO.1602439504987482), when available. */
  bsuid?: string | null;
  /** WhatsApp username without leading `@`, when available. */
  username?: string | null;
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
    const existingEntry = lead.existingContactId
      ? [...this.contacts.entries()].find(
          ([, entry]) => entry.id === lead.existingContactId,
        )
      : undefined;
    const key =
      lead.phone ??
      (lead.bsuid ? `bsuid:${lead.bsuid}` : null) ??
      lead.existingContactId ??
      `anon-${this.contacts.size + 1}`;
    const existing = existingEntry?.[1] ?? this.contacts.get(key);
    if (existingEntry && existingEntry[0] !== key) {
      this.contacts.delete(existingEntry[0]);
    }
    const id =
      existing?.id ??
      lead.existingContactId ??
      `fake-contact-${this.contacts.size + 1}`;
    this.contacts.set(key, { id, lead });
    return { contactId: id };
  }
}
