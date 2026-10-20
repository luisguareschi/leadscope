import type { AppContext } from "../../context.js";

/** Who a thread can be given to: the company's operators that are not archived. */
export async function listAssignees(
  ctx: AppContext,
  companyId: string,
  operatorId: string | null,
) {
  const operators = await ctx.db.operator.findMany({
    where: { companyId, archivedAt: null },
    orderBy: { email: "asc" },
    select: { id: true, email: true },
  });
  return {
    assignees: operators.map((operator) => ({
      ...operator,
      me: operator.id === operatorId,
    })),
  };
}
