import type { AppContext } from "../../context.js";
import type { OperatorAuth } from "../../http/require-operator.js";

export async function getMe(ctx: AppContext, operator: OperatorAuth) {
  const company = await ctx.db.company.findUniqueOrThrow({
    where: { id: operator.companyId },
    select: { name: true, slug: true },
  });
  return { operator: { email: operator.email }, company };
}
