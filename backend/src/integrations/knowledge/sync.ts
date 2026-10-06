import { CompanyRecord } from "../../store/types";
import { Store } from "../../store/types";
import { fetchSheetValues, loadFixtureProjects, rowsFromSheetValues } from "./sheet";
import { fetchPageText } from "./website";

export async function syncSheet(
  company: CompanyRecord,
  store: Store,
  platformServiceAccountJson: string,
): Promise<number> {
  const knowledge = company.config.knowledge;
  if (knowledge.source === "fixture") {
    return store.upsertProjects(company.id, await loadFixtureProjects(knowledge.fixturePath));
  }
  const serviceAccount = company.secrets.googleAccessJson || platformServiceAccountJson;
  if (!knowledge.sheetId || !serviceAccount) {
    throw new Error("Google sheet sync is not configured for this company");
  }
  const values = await fetchSheetValues({
    sheetId: knowledge.sheetId,
    range: knowledge.sheetRange,
    serviceAccountJson: serviceAccount,
  });
  return store.upsertProjects(company.id, rowsFromSheetValues(values, knowledge.columnMapping));
}

export async function syncSiteNotes(
  company: CompanyRecord,
  store: Store,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  let updated = 0;
  for (const page of company.config.knowledge.allowlistedUrls) {
    const text = await fetchPageText(page.url, fetchImpl);
    await store.updateProjectSiteNotes(company.id, page.projectSlug, text);
    updated += 1;
  }
  return updated;
}
