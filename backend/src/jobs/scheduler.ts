import { PrismaClient } from "@prisma/client";
import { syncAllCompanies } from "../services/knowledge.service";

export function startJobs(input: {
  db: PrismaClient;
  key: Buffer | null;
  sheetIntervalMs: number;
  siteIntervalMs: number;
  platformServiceAccountJson: string;
}): () => void {
  let sheetRunning = false;
  let siteRunning = false;

  const sheetTimer = setInterval(() => {
    if (sheetRunning) return;
    sheetRunning = true;
    void syncAllCompanies(input.db, input.key, input.platformServiceAccountJson, "sheet").finally(() => {
      sheetRunning = false;
    });
  }, input.sheetIntervalMs);

  const siteTimer = setInterval(() => {
    if (siteRunning) return;
    siteRunning = true;
    void syncAllCompanies(input.db, input.key, input.platformServiceAccountJson, "site").finally(() => {
      siteRunning = false;
    });
  }, input.siteIntervalMs);

  return () => {
    clearInterval(sheetTimer);
    clearInterval(siteTimer);
  };
}
