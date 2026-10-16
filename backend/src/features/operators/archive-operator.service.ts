import type { AppContext } from "../../context.js";
import { findOperator } from "./find-operator.js";
import { operatorSelect, toOperatorDto } from "./operator-dto.js";

/** The login keeps its Supabase user but gets 403 on every panel route until it is restored. */
export async function archiveOperator(
  ctx: AppContext,
  companyId: string,
  operatorId: string,
) {
  const found = await findOperator(ctx, companyId, operatorId);
  const operator = found.archivedAt
    ? found
    : await ctx.db.operator.update({
        where: { id: found.id },
        data: { archivedAt: ctx.now() },
        select: operatorSelect,
      });
  return toOperatorDto(ctx.env, operator);
}
