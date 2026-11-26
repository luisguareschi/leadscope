import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { isPlatformAdmin } from "../../http/platform-admin.js";
import type { PanelSession } from "../../http/require-session.js";
import { HttpError } from "../../lib/http-error.js";

/**
 * `company` is the one the panel works in: an operator's own (the one picked with `X-Company-Id`,
 * or the oldest), or the one a platform admin entered. `companies` are the login's active
 * memberships, for the company switcher.
 */
export async function getMe(
  ctx: AppContext,
  session: PanelSession,
  access: CompanyAccess | null,
) {
  const platformAdmin = isPlatformAdmin(ctx.env, session.sessionEmail);
  if (!access && !platformAdmin) {
    throw new HttpError(
      403,
      "Este usuario no tiene acceso al panel",
      "forbidden",
    );
  }
  const membership = access?.operatorId
    ? session.memberships.find((m) => m.operatorId === access.operatorId)
    : undefined;
  const company = membership
    ? {
        id: membership.companyId,
        name: membership.companyName,
        slug: membership.companySlug,
        assistantPaused: membership.companyAssistantPaused,
        assistantPausedAt: membership.companyAssistantPausedAt,
        assistantPausedByEmail: membership.companyAssistantPausedByEmail,
      }
    : access
      ? await ctx.db.company.findUniqueOrThrow({
          where: { id: access.companyId },
          select: {
            id: true,
            name: true,
            slug: true,
            assistantPaused: true,
            assistantPausedAt: true,
            assistantPausedByEmail: true,
          },
        })
      : null;
  const companies = session.memberships
    .filter((m) => !m.archived && !m.companyArchived)
    .map((m) => ({
      id: m.companyId,
      name: m.companyName,
      slug: m.companySlug,
      assistantPaused: m.companyAssistantPaused,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const operatorEmail = membership?.email ?? session.memberships[0]?.email;
  return {
    operator: operatorEmail ? { email: operatorEmail } : null,
    company,
    companies,
    platformAdmin,
    supportAccess: access?.support ?? false,
  };
}
