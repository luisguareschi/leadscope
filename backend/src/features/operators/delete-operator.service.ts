import type { AppContext } from "../../context.js";
import { findOperator } from "./find-operator.js";
import { removeAuthUserIfUnused } from "./remove-auth-user.js";

/** Removes the row. Files it uploaded stay, with no uploader. */
export async function deleteOperator(
  ctx: AppContext,
  companyId: string,
  operatorId: string,
) {
  const operator = await findOperator(ctx, companyId, operatorId);
  await ctx.db.operator.delete({ where: { id: operator.id } });
  return { authUser: await removeAuthUserIfUnused(ctx, operator) };
}
