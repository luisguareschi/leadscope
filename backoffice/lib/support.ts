"use client";

/**
 * Sent with every API request once the tab has a company: one the operator picked in the company
 * switcher, or one a platform admin entered from Empresas.
 */
export const COMPANY_ID_HEADER = "X-Company-Id";

/** Per tab (sessionStorage), so switching in one tab never moves another that shows other data. */
const SELECTION_KEY = "leadscope.companySelection";
/** Written by Entrar before one login could belong to several companies. Read once, then moved. */
const LEGACY_SUPPORT_KEY = "leadscope.supportCompany";
/** The operator's last pick (localStorage), so a new tab opens in it. */
const LAST_KEY = "leadscope.lastCompany";

type Selection = {
  companyId: string;
  email: string;
  /** `support`: a platform admin entered it from Empresas. */
  kind: "operator" | "support";
};

type LastCompany = { companyId: string; email: string };

/** Looked up inside each try: reading `window.localStorage` itself throws when storage is blocked. */
type Area = "sessionStorage" | "localStorage";

function readJson(area: Area, key: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(window[area].getItem(key) ?? "null");
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function write(area: Area, key: string, value: unknown): void {
  try {
    window[area].setItem(key, JSON.stringify(value));
  } catch {
    // Storage blocked (private mode): the tab falls back to the API's default company.
  }
}

function remove(area: Area, key: string): void {
  try {
    window[area].removeItem(key);
  } catch {
    // Nothing stored, nothing to clear.
  }
}

function readSelection(migrate = false): Selection | null {
  const { companyId, email, kind } = readJson("sessionStorage", SELECTION_KEY);
  if (
    typeof companyId === "string" &&
    typeof email === "string" &&
    (kind === "operator" || kind === "support")
  )
    return { companyId, email, kind };
  const legacy = readJson("sessionStorage", LEGACY_SUPPORT_KEY);
  if (
    typeof legacy.companyId === "string" &&
    typeof legacy.adminEmail === "string"
  ) {
    const moved: Selection = {
      companyId: legacy.companyId,
      email: legacy.adminEmail,
      kind: "support",
    };
    if (migrate) {
      write("sessionStorage", SELECTION_KEY, moved);
      remove("sessionStorage", LEGACY_SUPPORT_KEY);
    }
    return moved;
  }
  return null;
}

function readLast(): LastCompany | null {
  const { companyId, email } = readJson("localStorage", LAST_KEY);
  return typeof companyId === "string" && typeof email === "string"
    ? { companyId, email }
    : null;
}

/**
 * Pure read of this tab's company for that login: its own pick, else the login's last pick, else
 * null. Another login never inherits it. Safe to call during render.
 */
export function companySelectionFor(
  email: string | null,
): Pick<Selection, "companyId" | "kind"> | null {
  if (!email) return null;
  const owner = email.toLowerCase();
  const selection = readSelection();
  if (selection?.email === owner)
    return { companyId: selection.companyId, kind: selection.kind };
  const last = readLast();
  if (last?.email !== owner) return null;
  return { companyId: last.companyId, kind: "operator" };
}

/**
 * Reads the active company for an API request and pins any seeded `localStorage` pick (or legacy
 * support key) into this tab's `sessionStorage`, so another tab cannot move this one mid-session.
 */
export function activeCompanyIdFor(email: string | null): string | null {
  if (!email) return null;
  const owner = email.toLowerCase();
  const selection = readSelection(true);
  if (selection?.email === owner) return selection.companyId;
  const last = readLast();
  if (last?.email !== owner) return null;
  write("sessionStorage", SELECTION_KEY, {
    companyId: last.companyId,
    email: owner,
    kind: "operator",
  } satisfies Selection);
  return last.companyId;
}

/** Company pages that exist in every company. Anything else (a thread, Empresas) lands on Conversaciones. */
const COMPANY_PAGES = [
  "/threads",
  "/metrics",
  "/knowledge",
  "/probar",
  "/settings",
];

function pageAfterSwitch(pathname: string | undefined): string {
  return pathname && COMPANY_PAGES.includes(pathname) ? pathname : "/threads";
}

/** Moves this tab to another of the operator's companies, and makes it the one new tabs open in. */
export function switchCompany(
  companyId: string,
  email: string,
  currentPathname?: string,
): void {
  const owner = email.toLowerCase();
  write("sessionStorage", SELECTION_KEY, {
    companyId,
    email: owner,
    kind: "operator",
  } satisfies Selection);
  write("localStorage", LAST_KEY, {
    companyId,
    email: owner,
  } satisfies LastCompany);
  // A full load drops every cached query of the previous company.
  window.location.assign(pageAfterSwitch(currentPathname));
}

/** Support access from Empresas or the super-admin switcher. Not remembered for new tabs. */
export function enterCompany(
  companyId: string,
  adminEmail: string,
  currentPathname?: string,
): void {
  write("sessionStorage", SELECTION_KEY, {
    companyId,
    email: adminEmail.toLowerCase(),
    kind: "support",
  } satisfies Selection);
  // A full load drops every cached query of the previous company.
  window.location.assign(pageAfterSwitch(currentPathname));
}

/**
 * Keeps this tab on the company it rendered, so a switch in another tab (which rewrites the last
 * pick) cannot move it on its next request.
 */
export function pinOperatorCompany(companyId: string, email: string): void {
  const owner = email.toLowerCase();
  if (readSelection()?.email === owner) return;
  write("sessionStorage", SELECTION_KEY, {
    companyId,
    email: owner,
    kind: "operator",
  } satisfies Selection);
}

/**
 * Clears this tab's stored company. Pass `includeLast: true` on sign-out, or pass
 * `onlyIfLastCompanyId` during stale recovery so another tab's valid `lastCompany` is kept.
 */
export function clearActiveCompany(options?: {
  includeLast?: boolean;
  onlyIfLastCompanyId?: string;
}): void {
  remove("sessionStorage", SELECTION_KEY);
  remove("sessionStorage", LEGACY_SUPPORT_KEY);
  if (options?.includeLast) {
    remove("localStorage", LAST_KEY);
    return;
  }
  if (
    options?.onlyIfLastCompanyId &&
    readLast()?.companyId === options.onlyIfLastCompanyId
  ) {
    remove("localStorage", LAST_KEY);
  }
}
