import type { AppContext } from "../../context.js";
import {
  lookupOperatorAuth,
  operatorSelect,
  toOperatorDto,
} from "./operator-dto.js";

export async function listOperators(ctx: AppContext, companyId: string) {
  const operators = await ctx.db.operator.findMany({
    where: { companyId },
    select: operatorSelect,
    orderBy: { createdAt: "asc" },
  });
  const authStates = await Promise.all(
    operators.map((operator) =>
      lookupOperatorAuth(ctx, operator.supabaseUserId),
    ),
  );
  return operators.map((operator, index) =>
    toOperatorDto(ctx.env, operator, authStates[index]),
  );
}
