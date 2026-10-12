import type { AppContext } from "../../context.js";
import type { CompanyAccess } from "../../http/company-access.js";
import { isPlatformAdmin } from "../../http/platform-admin.js";
import type { PanelSession } from "../../http/require-session.js";
import { HttpError } from "../../lib/http-error.js";

/** `company` is the one the panel works in: the operator's own, or the one a platform admin entered. */
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
  const company = access
    ? await ctx.db.company.findUniqueOrThrow({
        where: { id: access.companyId },
        select: { name: true, slug: true },
      })
    : null;
  return {
    operator: session.operator ? { email: session.operator.email } : null,
    company,
    platformAdmin,
    supportAccess: access?.support ?? false,
  };
}
