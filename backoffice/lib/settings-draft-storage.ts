import type { TestDraftOverride } from "./types";

const DRAFT_EVENT = "leadscope:settings-test-draft";

const keyFor = (owner: string) => `leadscope.settings-test-draft.${owner}`;

/**
 * Holds unsaved Configuración / Instrucciones changes in sessionStorage so `Probar asistente`
 * can test them before saving to production (scoped per signed-in person and company).
 */
export function saveSettingsTestDraft(
  owner: string,
  draft: TestDraftOverride,
): void {
  try {
    const existing = loadSettingsTestDraft(owner) ?? {};
    const merged: TestDraftOverride = { ...existing, ...draft };
    window.sessionStorage.setItem(keyFor(owner), JSON.stringify(merged));
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    // Ignore storage errors in private mode.
  }
}

export function loadSettingsTestDraft(owner: string): TestDraftOverride | null {
  try {
    const raw = window.sessionStorage.getItem(keyFor(owner));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TestDraftOverride;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSettingsTestDraft(owner: string): void {
  try {
    window.sessionStorage.removeItem(keyFor(owner));
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    // Ignore storage errors.
  }
}

export function clearSettingsTestDraftKeys(
  owner: string,
  keys: Array<keyof TestDraftOverride>,
): void {
  try {
    const existing = loadSettingsTestDraft(owner);
    if (!existing) return;
    const next: TestDraftOverride = { ...existing };
    for (const key of keys) delete next[key];
    if (Object.keys(next).length === 0) {
      window.sessionStorage.removeItem(keyFor(owner));
    } else {
      window.sessionStorage.setItem(keyFor(owner), JSON.stringify(next));
    }
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    // Ignore storage errors.
  }
}

export function subscribeSettingsTestDraft(onChange: () => void): () => void {
  window.addEventListener(DRAFT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(DRAFT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
