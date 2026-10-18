/** Where a company's Kapso webhook must point, after the backend's public URL. */
export function kapsoWebhookPath(companySlug: string): string {
  return `/webhooks/kapso/${encodeURIComponent(companySlug)}`;
}
