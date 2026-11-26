import type { Request, RequestHandler } from "express";
import type { AppContext } from "../context.js";
import { HttpError, notFound } from "../lib/http-error.js";
import { isPlatformAdmin } from "./platform-admin.js";
import {
  noPanelAccess,
  sessionOf,
  type OperatorMembership,
} from "./require-session.js";
import { auditSupportWrite } from "./admin-audit.js";

/**
 * The company the panel tab works in: one the operator picked in the company switcher, or one a
 * platform admin entered from Empresas.
 */
export const COMPANY_ID_HEADER = "X-Company-Id";

/** The company a request acts on, and who is acting. */
export type CompanyAccess = {
  companyId: string;
  /** Null when a platform admin works in the company through support access. */
  operatorId: string | null;
  /** Signed-in email of whoever is acting. */
  actorEmail: string;
  /** A platform admin entered a company they are not an operator of. Their writes are audited. */
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
    "Tu acceso está archivado. Contacta a un administrador de la plataforma para restaurarlo.",
    "operator_archived",
  );

export const companyNotAccessible = () =>
  new HttpError(
    403,
    "No tienes acceso a esta empresa.",
    "company_not_accessible",
  );

const isActive = (membership: OperatorMembership) =>
  !membership.archived && !membership.companyArchived;

/**
 * With `X-Company-Id`, the request acts on that company: as its operator when the login has an
 * active operator row there (even a platform admin), otherwise as a platform admin through support
 * access. Anyone else gets 403 `company_not_accessible`; an explicit header never falls back to
 * another company, so a stale tab cannot write to the wrong one. Without it, the oldest active
 * membership is used. Null when there is none and the login is a platform admin or has no
 * operator row at all. An archived company is 403 for everyone; an archived operator row is 403
 * unless the login is a platform admin, who then works through support access.
 */
export async function resolveCompanyAccess(
  ctx: AppContext,
  req: Request,
): Promise<CompanyAccess | null> {
  const session = sessionOf(req);
  const platformAdmin = isPlatformAdmin(ctx.env, session.sessionEmail);
  const asOperator = (membership: OperatorMembership): CompanyAccess => ({
    companyId: membership.companyId,
    operatorId: membership.operatorId,
    actorEmail: session.sessionEmail,
    support: false,
  });
  const requested = req.header(COMPANY_ID_HEADER)?.trim();

  if (requested) {
    const membership = session.memberships.find(
      (m) => m.companyId === requested,
    );
    if (membership?.companyArchived) throw companyArchived();
    if (membership && !membership.archived) return asOperator(membership);
    if (!platformAdmin)
      throw membership ? operatorArchived() : companyNotAccessible();
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

  const active = session.memberships.find(isActive);
  if (active) return asOperator(active);
  if (platformAdmin || session.memberships.length === 0) return null;
  throw session.memberships.some((m) => m.archived && !m.companyArchived)
    ? operatorArchived()
    : companyArchived();
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
