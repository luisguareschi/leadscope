import { syncSheet, syncSiteNotes } from "../integrations/knowledge/sync";
import { log } from "../logger";
import { Store } from "../store/types";

export function startJobs(input: {
  store: Store;
  sheetIntervalMs: number;
  siteIntervalMs: number;
  platformServiceAccountJson: string;
}): () => void {
  let sheetRunning = false;
  let siteRunning = false;

  const sheetTimer = setInterval(() => {
    if (sheetRunning) return;
    sheetRunning = true;
    void runSheets().finally(() => {
      sheetRunning = false;
    });
  }, input.sheetIntervalMs);

  const siteTimer = setInterval(() => {
    if (siteRunning) return;
    siteRunning = true;
    void runSites().finally(() => {
      siteRunning = false;
    });
  }, input.siteIntervalMs);

  async function runSheets(): Promise<void> {
    const companies = await input.store.listCompanies();
    for (const company of companies) {
      try {
        await syncSheet(company, input.store, input.platformServiceAccountJson);
      } catch (err) {
        log.error({ err, companyId: company.id }, "scheduled sheet sync failed");
      }
    }
  }

  async function runSites(): Promise<void> {
    const companies = await input.store.listCompanies();
    for (const company of companies) {
      try {
        await syncSiteNotes(company, input.store);
      } catch (err) {
        log.error({ err, companyId: company.id }, "scheduled site notes failed");
      }
    }
  }

  return () => {
    clearInterval(sheetTimer);
    clearInterval(siteTimer);
  };
}
