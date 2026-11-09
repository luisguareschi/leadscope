import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { getCompaniesMetrics } from "./get-companies-metrics.service.js";
import {
  companiesMetricsQuerySchema,
  parseMetricsInput,
} from "./metrics-range.js";

export function getCompaniesMetricsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const query = parseMetricsInput(companiesMetricsQuerySchema, req.query);
    res.json(await getCompaniesMetrics(ctx, query));
  };
}
