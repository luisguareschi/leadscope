/** Where the company's CRM workflow posts form leads, after the backend's public URL. */
export function formLeadPath(companySlug: string): string {
  return `/hooks/crm/form-lead/${encodeURIComponent(companySlug)}`;
}
