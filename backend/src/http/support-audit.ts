import type { Request, Response } from "express";
import type { AppContext } from "../context.js";
import { reportError } from "../lib/monitoring.js";
import type { CompanyAccess } from "./company-access.js";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Records a platform admin's write inside a company before the handler runs, then the response
 * status once it is sent. Reads are not recorded. Bodies are never stored: they can hold secrets.
 */
export async function auditSupportWrite(
  ctx: AppContext,
  req: Request,
  res: Response,
  access: CompanyAccess,
): Promise<void> {
  if (!WRITE_METHODS.has(req.method)) return;
  const entry = await ctx.db.adminAuditEntry.create({
    data: {
      companyId: access.companyId,
      adminEmail: access.actorEmail,
      action: `${req.method} ${req.originalUrl.split("?")[0]}`,
    },
    select: { id: true },
  });
  res.once("close", () => {
    ctx.db.adminAuditEntry
      .update({
        where: { id: entry.id },
        data: { status: res.writableFinished ? res.statusCode : null },
      })
      .catch((error: unknown) => {
        ctx.logger.error(
          { err: error, companyId: access.companyId },
          "admin audit status not saved",
        );
        reportError(error);
      });
  });
}
