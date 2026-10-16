import type { Request, RequestHandler } from "express";
import type { AppContext } from "../context.js";
import { HttpError, notFound } from "../lib/http-error.js";
import { isPlatformAdmin } from "./platform-admin.js";
import { noPanelAccess, sessionOf } from "./require-session.js";
import { auditSupportWrite } from "./admin-audit.js";

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

export const companyArchived = () =>
  new HttpError(
    403,
    "Esta empresa está archivada, así que su panel no está disponible.",
    "company_archived",
  );

export const operatorArchived = () =>
  new HttpError(
    403,
    "Tu acceso a este panel está archivado. Pedile a quien administra la plataforma que lo restaure.",
    "operator_archived",
  );

/**
 * `X-Company-Id` is honored only when the signed-in email is on `PLATFORM_ADMIN_EMAILS`, and that
 * admin needs no operator row in the company. For everyone else the company is their operator
 * row's and the header is ignored. Null when the login has neither. An archived operator, or one
 * whose company is archived, gets 403; a platform admin in that situation is treated as having no
 * operator row, so Empresas stays open to them.
 */
export async function resolveCompanyAccess(
  ctx: AppContext,
  req: Request,
): Promise<CompanyAccess | null> {
  const session = sessionOf(req);
  const platformAdmin = isPlatformAdmin(ctx.env, session.sessionEmail);
  const requested = req.header(COMPANY_ID_HEADER)?.trim();
  if (requested && platformAdmin) {
    const company = await ctx.db.company.findUnique({
      where: { id: requested },
      select: { id: true, archivedAt: true },
    });
    if (!company) throw notFound("Empresa no encontrada");
    if (company.archivedAt) throw companyArchived();
    return {
      companyId: company.id,
      operatorId: null,
      actorEmail: session.sessionEmail,
      support: true,
    };
  }
  if (!session.operator) return null;
  if (session.operator.archived || session.operator.companyArchived) {
    if (platformAdmin) return null;
    throw session.operator.archived ? operatorArchived() : companyArchived();
  }
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
