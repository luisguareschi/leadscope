import type { AppContext } from "../../context.js";
import { notFound } from "../../lib/http-error.js";
import { operatorSelect } from "./operator-dto.js";

/** An operator of that company, or 404. */
export async function findOperator(
  ctx: AppContext,
  companyId: string,
  operatorId: string,
) {
  const operator = await ctx.db.operator.findFirst({
    where: { id: operatorId, companyId },
    select: operatorSelect,
  });
  if (!operator) throw notFound("Operador no encontrado");
  return operator;
}
