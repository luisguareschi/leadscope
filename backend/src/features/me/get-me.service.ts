import type { AppContext } from "../../context.js";
import { isPlatformAdmin } from "../../http/platform-admin.js";
import type { PanelSession } from "../../http/require-operator.js";
import { HttpError } from "../../lib/http-error.js";

export async function getMe(ctx: AppContext, session: PanelSession) {
  const platformAdmin = isPlatformAdmin(ctx.env, session.sessionEmail);
  if (!session.operator) {
    if (!platformAdmin) {
      throw new HttpError(
        403,
        "Este usuario no tiene acceso al panel",
        "forbidden",
      );
    }
    return { operator: null, company: null, platformAdmin: true };
  }
  const company = await ctx.db.company.findUniqueOrThrow({
    where: { id: session.operator.companyId },
    select: { name: true, slug: true },
  });
  return {
    operator: { email: session.operator.email },
    company,
    platformAdmin,
  };
}
