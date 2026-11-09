import { parseCompanyConfig } from "../../companies/company-config.js";
import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import {
  computeCompanyMetrics,
  metricsCompanySelect,
  type CompanyMetrics,
} from "./compute-company-metrics.js";
import {
  resolveMetricsRange,
  type MetricsRangeQuery,
} from "./metrics-range.js";

export async function getMetrics(
  ctx: AppContext,
  companyId: string,
  query: MetricsRangeQuery,
): Promise<CompanyMetrics> {
  const company = await ctx.db.company.findUnique({
    where: { id: companyId },
    select: metricsCompanySelect,
  });
  if (!company) throw notFound("Empresa no encontrada");
  const timeZone = parseCompanyConfig(company.config).timezone;
  return computeCompanyMetrics(
    ctx,
    company,
    resolveMetricsRange(query, timeZone, ctx.now()),
  );
}
