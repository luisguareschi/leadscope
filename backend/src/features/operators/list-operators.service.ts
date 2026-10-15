import type { AppContext } from "../../context.js";
import { operatorSelect, toOperatorDto } from "./operator-dto.js";

export async function listOperators(ctx: AppContext, companyId: string) {
  const operators = await ctx.db.operator.findMany({
    where: { companyId },
    select: operatorSelect,
    orderBy: { createdAt: "asc" },
  });
  return operators.map((operator) => toOperatorDto(ctx.env, operator));
}
