import { PrismaClient } from "@prisma/client";
import { CompanyView, readCompany } from "../companies/load";
import { fetchSheetValues, loadFixtureProjects, ProjectDraft, rowsFromSheetValues } from "../integrations/knowledge/sheet";
import { fetchPageText } from "../integrations/knowledge/website";
import { log } from "../logger";

export async function knowledgeStatus(db: PrismaClient, companyId: string) {
  const projects = await db.project.findMany({ where: { companyId } });
  const lastSyncedAt = projects.reduce<string | null>((latest, project) => {
    if (!project.syncedAt) return latest;
    const iso = project.syncedAt.toISOString();
    if (!latest || iso > latest) return iso;
    return latest;
  }, null);
  return { projectCount: projects.length, lastSyncedAt };
}

export async function listProjectFacts(db: PrismaClient, companyId: string) {
  const rows = await db.project.findMany({ where: { companyId }, orderBy: { name: "asc" } });
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    priceFrom: row.priceFrom,
    typologies: row.typologies,
    deliveryDate: row.deliveryDate,
    orientation: row.orientation,
    notes: row.notes,
    siteNotes: row.siteNotes,
  }));
}

async function upsertProjects(db: PrismaClient, companyId: string, rows: ProjectDraft[]): Promise<number> {
  const now = new Date();
  for (const row of rows) {
    await db.project.upsert({
      where: { companyId_slug: { companyId, slug: row.slug } },
      create: { companyId, ...row, syncedAt: now },
      update: {
        name: row.name,
        priceFrom: row.priceFrom,
        typologies: row.typologies,
        deliveryDate: row.deliveryDate,
        orientation: row.orientation,
        notes: row.notes,
        syncedAt: now,
      },
    });
  }
  return rows.length;
}

export async function syncSheetForCompany(
  db: PrismaClient,
  company: CompanyView,
  platformServiceAccountJson: string,
): Promise<number> {
  const knowledge = company.config.knowledge;
  if (knowledge.source === "fixture") {
    return upsertProjects(db, company.id, await loadFixtureProjects(knowledge.fixturePath));
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
  return upsertProjects(db, company.id, rowsFromSheetValues(values, knowledge.columnMapping));
}

export async function syncSiteNotesForCompany(
  db: PrismaClient,
  company: CompanyView,
  fetchImpl: typeof fetch = fetch,
): Promise<number> {
  let updated = 0;
  for (const page of company.config.knowledge.allowlistedUrls) {
    const text = await fetchPageText(page.url, fetchImpl);
    await db.project.updateMany({
      where: { companyId: company.id, slug: page.projectSlug },
      data: { siteNotes: text, syncedAt: new Date() },
    });
    updated += 1;
  }
  return updated;
}

export async function syncKnowledge(
  db: PrismaClient,
  company: CompanyView,
  platformServiceAccountJson: string,
  siteNotes: boolean,
): Promise<{ upserted: number; siteNotes: number; lastSyncedAt: string | null }> {
  const upserted = await syncSheetForCompany(db, company, platformServiceAccountJson);
  const notes = siteNotes ? await syncSiteNotesForCompany(db, company) : 0;
  const status = await knowledgeStatus(db, company.id);
  return { upserted, siteNotes: notes, lastSyncedAt: status.lastSyncedAt };
}

export async function syncAllCompanies(
  db: PrismaClient,
  key: Buffer | null,
  platformServiceAccountJson: string,
  which: "sheet" | "site",
): Promise<void> {
  const rows = await db.company.findMany();
  for (const row of rows) {
    const company = readCompany(row, key);
    try {
      if (which === "sheet") await syncSheetForCompany(db, company, platformServiceAccountJson);
      else await syncSiteNotesForCompany(db, company);
    } catch (err) {
      log.error({ err, companyId: company.id }, which === "sheet" ? "scheduled sheet sync failed" : "scheduled site notes failed");
    }
  }
}
