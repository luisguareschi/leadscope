"use client";

/** Sent with every API request while a platform admin is inside a company. */
export const COMPANY_ID_HEADER = "X-Company-Id";

const SUPPORT_KEY = "leadscope.supportCompany";

type StoredSupport = { companyId: string; adminEmail: string };

/**
 * Per tab (sessionStorage), so another open tab never starts sending a different company's id
 * under a page that still shows its own data.
 */
function readStored(): StoredSupport | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(SUPPORT_KEY) ?? "null",
    ) as Partial<StoredSupport> | null;
    return typeof value?.companyId === "string" &&
      typeof value.adminEmail === "string"
      ? { companyId: value.companyId, adminEmail: value.adminEmail }
      : null;
  } catch {
    return null;
  }
}

/** The company the signed-in admin entered from Empresas, if any. Another login never inherits it. */
export function supportCompanyIdFor(email: string | null): string | null {
  const stored = readStored();
  return stored && email && stored.adminEmail === email.toLowerCase()
    ? stored.companyId
    : null;
}

export function clearSupportCompany(): void {
  sessionStorage.removeItem(SUPPORT_KEY);
}

export function enterCompany(companyId: string, adminEmail: string): void {
  sessionStorage.setItem(
    SUPPORT_KEY,
    JSON.stringify({ companyId, adminEmail: adminEmail.toLowerCase() }),
  );
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load drops every cached query of the previous company
  window.location.assign("/threads");
}

export function leaveCompany(): void {
  clearSupportCompany();
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load drops every cached query of the entered company
  window.location.assign("/companies");
}
