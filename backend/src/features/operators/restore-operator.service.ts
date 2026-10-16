import type { AppContext } from "../../context.js";
import { findOperator } from "./find-operator.js";
import { operatorSelect, toOperatorDto } from "./operator-dto.js";

export async function restoreOperator(
  ctx: AppContext,
  companyId: string,
  operatorId: string,
) {
  const found = await findOperator(ctx, companyId, operatorId);
  const operator = await ctx.db.operator.update({
    where: { id: found.id },
    data: { archivedAt: null },
    select: operatorSelect,
  });
  return toOperatorDto(ctx.env, operator);
}
