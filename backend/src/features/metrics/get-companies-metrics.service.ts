import type { AppContext } from "../../context.js";
import {
  computeCompanyMetrics,
  metricsCompanySelect,
  type CompanyMetrics,
  type MetricsCompany,
} from "./compute-company-metrics.js";
import {
  COMPARISON_TIME_ZONE,
  resolveMetricsRange,
  type CompaniesMetricsQuery,
} from "./metrics-range.js";

export type CompaniesMetrics = {
  range: { from: string; to: string };
  rows: {
    company: { id: string; name: string; slug: string; archived: boolean };
    leads: number;
    qualificationRate: number | null;
    notInterestedRate: number | null;
    outOfHoursRate: number | null;
    medianMinutesToContact: number | null;
    unassignedToContact: number;
    needsHuman: number;
    daysSinceLastUpload: number | null;
    spendUsd: number;
  }[];
};

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await run(item);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  return results;
}

function toRow(company: MetricsCompany, metrics: CompanyMetrics) {
  return {
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      archived: company.archivedAt !== null,
    },
    leads: metrics.leads,
    qualificationRate: metrics.qualificationRate,
    notInterestedRate: metrics.notInterestedRate,
    outOfHoursRate: metrics.outOfHoursRate,
    medianMinutesToContact: metrics.timeToContact.medianMinutes,
    unassignedToContact: metrics.queue.unassigned,
    needsHuman: metrics.needsHuman.total,
    daysSinceLastUpload: metrics.knowledge.daysSinceLastUpload,
    spendUsd: metrics.spend.totalUsd,
  };
}

export async function getCompaniesMetrics(
  ctx: AppContext,
  query: CompaniesMetricsQuery,
): Promise<CompaniesMetrics> {
  const range = resolveMetricsRange(query, COMPARISON_TIME_ZONE, ctx.now());
  const companies = await ctx.db.company.findMany({
    where: query.status === "all" ? {} : { archivedAt: null },
    select: metricsCompanySelect,
  });
  const metrics = await mapWithConcurrency(companies, 4, (company) =>
    computeCompanyMetrics(ctx, company, range),
  );
  const rows = companies.map((company, index) => {
    const row = metrics[index];
    if (!row) throw new Error("Missing company metrics");
    return toRow(company, row);
  });
  rows.sort(
    (a, b) =>
      b.leads - a.leads || a.company.name.localeCompare(b.company.name, "es"),
  );
  return { range: { from: range.from, to: range.to }, rows };
}
