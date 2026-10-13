import type { Request, RequestHandler } from "express";
import type { AppContext } from "../context.js";
import { HttpError, notFound } from "../lib/http-error.js";
import { isPlatformAdmin } from "./platform-admin.js";
import { noPanelAccess, sessionOf } from "./require-session.js";
import { auditSupportWrite } from "./support-audit.js";

/** Sent by the panel after a platform admin clicks Entrar on a company in Empresas. */
export const COMPANY_ID_HEADER = "X-Company-Id";

/** The company a request acts on, and who is acting. */
export type CompanyAccess = {
  companyId: string;
  /** Null when a platform admin works in the company through support access. */
  operatorId: string | null;
  /** Signed-in email of whoever is acting. */
  actorEmail: string;
  /** A platform admin entered this company from Empresas. Their writes are audited. */
  support: boolean;
};

type RequestWithAccess = Request & { companyAccess?: CompanyAccess };

/**
 * `X-Company-Id` is honored only when the signed-in email is on `PLATFORM_ADMIN_EMAILS`, and that
 * admin needs no operator row in the company. For everyone else the company is their operator
 * row's and the header is ignored. Null when the login has neither.
 */
export async function resolveCompanyAccess(
  ctx: AppContext,
  req: Request,
): Promise<CompanyAccess | null> {
  const session = sessionOf(req);
  const requested = req.header(COMPANY_ID_HEADER)?.trim();
  if (requested && isPlatformAdmin(ctx.env, session.sessionEmail)) {
    const company = await ctx.db.company.findUnique({
      where: { id: requested },
      select: { id: true },
    });
    if (!company) throw notFound("Empresa no encontrada");
    return {
      companyId: company.id,
      operatorId: null,
      actorEmail: session.sessionEmail,
      support: true,
    };
  }
  if (!session.operator) return null;
  return {
    companyId: session.operator.companyId,
    operatorId: session.operator.operatorId,
    actorEmail: session.sessionEmail,
    support: false,
  };
}

/**
 * Company routes (threads, knowledge, secrets). A login with no operator row and no honored
 * `X-Company-Id` gets 403. A write made through support access is recorded before it runs.
 */
export function requireCompanyAccess(ctx: AppContext): RequestHandler {
  return async (req, res, next) => {
    const access = await resolveCompanyAccess(ctx, req);
    if (!access) {
      res.status(403).json(noPanelAccess);
      return;
    }
    (req as RequestWithAccess).companyAccess = access;
    if (access.support) await auditSupportWrite(ctx, req, res, access);
    next();
  };
}

export function companyAccessOf(req: Request): CompanyAccess {
  const access = (req as RequestWithAccess).companyAccess;
  if (!access) throw new HttpError(401, "No autenticado", "unauthorized");
  return access;
}
