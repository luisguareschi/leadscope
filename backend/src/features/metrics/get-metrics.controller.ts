import type { RequestHandler } from "express";
import type { AppContext } from "../../context.js";
import { resolveCompanyAccess } from "../../http/company-access.js";
import { isPlatformAdmin } from "../../http/platform-admin.js";
import { noPanelAccess, sessionOf } from "../../http/require-session.js";
import { badRequest } from "../../lib/http-error.js";
import { getMetrics } from "./get-metrics.service.js";
import { metricsRangeQuerySchema, parseMetricsInput } from "./metrics-range.js";

function companyIdFromQuery(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getMetricsController(ctx: AppContext): RequestHandler {
  return async (req, res) => {
    const access = await resolveCompanyAccess(ctx, req);
    let companyId: string;
    if (access) {
      companyId = access.companyId;
    } else if (isPlatformAdmin(ctx.env, sessionOf(req).sessionEmail)) {
      const requested = companyIdFromQuery(req.query.companyId);
      if (!requested) throw badRequest("Elige una empresa.");
      companyId = requested;
    } else {
      res.status(403).json(noPanelAccess);
      return;
    }
    const query = parseMetricsInput(metricsRangeQuerySchema, {
      from: req.query.from,
      to: req.query.to,
    });
    res.json(await getMetrics(ctx, companyId, query));
  };
}
