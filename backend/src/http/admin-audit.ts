import type { Request, RequestHandler, Response } from "express";
import type { AppContext } from "../context.js";
import { notFound } from "../lib/http-error.js";
import { reportError } from "../lib/monitoring.js";
import type { CompanyAccess } from "./company-access.js";
import { sessionOf } from "./require-session.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Records a platform admin's write before the handler runs, then the response status once it is
 * sent. Reads are not recorded. Bodies are never stored: they can hold secrets.
 */
async function recordAdminWrite(
  ctx: AppContext,
  req: Request,
  res: Response,
  entry: { companyId: string; companySlug: string; adminEmail: string },
): Promise<void> {
  if (!WRITE_METHODS.has(req.method)) return;
  const { id } = await ctx.db.adminAuditEntry.create({
    data: {
      ...entry,
      action: `${req.method} ${req.originalUrl.split("?")[0]}`,
    },
    select: { id: true },
  });
  res.once("close", () => {
    ctx.db.adminAuditEntry
      .update({
        where: { id },
        data: { status: res.writableFinished ? res.statusCode : null },
      })
      .catch((error: unknown) => {
        ctx.logger.error(
          { err: error, companyId: entry.companyId },
          "admin audit status not saved",
        );
        reportError(error);
      });
  });
}

/** A write inside a company through support access (`X-Company-Id`). */
export async function auditSupportWrite(
  ctx: AppContext,
  req: Request,
  res: Response,
  access: CompanyAccess,
): Promise<void> {
  if (!WRITE_METHODS.has(req.method)) return;
  const company = await ctx.db.company.findUniqueOrThrow({
    where: { id: access.companyId },
    select: { slug: true },
  });
  await recordAdminWrite(ctx, req, res, {
    companyId: access.companyId,
    companySlug: company.slug,
    adminEmail: access.actorEmail,
  });
}

/**
 * Empresas routes under `/:companyId` (archive, restore, delete, operators), after
 * `requirePlatformAdmin`. An unknown company is 404 for every method.
 */
export function auditCompanyWrites(ctx: AppContext): RequestHandler {
  return async (req, res, next) => {
    const companyId = String(req.params.companyId ?? "");
    const company = await ctx.db.company.findUnique({
      where: { id: companyId },
      select: { id: true, slug: true },
    });
    if (!company) throw notFound("Empresa no encontrada");
    await recordAdminWrite(ctx, req, res, {
      companyId: company.id,
      companySlug: company.slug,
      adminEmail: sessionOf(req).sessionEmail,
    });
    next();
  };
}
