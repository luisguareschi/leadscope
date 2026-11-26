import type { AppContext } from "../../context.js";
import { findOperator } from "./find-operator.js";
import {
  lookupOperatorAuth,
  operatorSelect,
  toOperatorDto,
} from "./operator-dto.js";

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
  const auth = await lookupOperatorAuth(ctx, operator.supabaseUserId);
  return toOperatorDto(ctx.env, operator, auth);
}
