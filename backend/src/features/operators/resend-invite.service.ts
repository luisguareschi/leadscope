import type { AppContext } from "../../context.js";
import { conflict } from "../../lib/http-error.js";
import { findOperator } from "./find-operator.js";
import { inviteOperator } from "./invite-operator.js";
import { operatorSelect, toOperatorDto } from "./operator-dto.js";

export async function resendInvite(
  ctx: AppContext,
  companyId: string,
  operatorId: string,
  panelOrigin: string,
) {
  const found = await findOperator(ctx, companyId, operatorId);
  if (found.archivedAt)
    throw conflict(
      "El operador está archivado. Restauralo antes de reenviar la invitación.",
      "operator_archived",
    );
  const invite = await inviteOperator(ctx, found, {
    resend: true,
    panelOrigin,
  });
  const operator = await ctx.db.operator.findUniqueOrThrow({
    where: { id: found.id },
    select: operatorSelect,
  });
  return { operator: toOperatorDto(ctx.env, operator), invite };
}
