import type { AppContext } from "../../context.js";
import { conflict } from "../../lib/http-error.js";
import { isUniqueViolation } from "../../lib/prisma.js";
import { inviteOperator } from "./invite-operator.js";
import { operatorSelect, toOperatorDto } from "./operator-dto.js";

const emailTaken = () =>
  conflict("Ese email ya es operador de una empresa.", "email_taken");

/**
 * Saves the operator row, then creates their Supabase user and emails the invitation. If the
 * invitation fails the row stays (so it can be resent) and the reason comes back with it.
 */
export async function addOperator(
  ctx: AppContext,
  companyId: string,
  email: string,
) {
  const taken = await ctx.db.operator.findUnique({
    where: { email },
    select: { id: true },
  });
  if (taken) throw emailTaken();
  let created: { id: string; email: string };
  try {
    created = await ctx.db.operator.create({
      data: { companyId, email },
      select: { id: true, email: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw emailTaken();
    throw error;
  }
  const invite = await inviteOperator(ctx, created, { resend: false });
  const operator = await ctx.db.operator.findUniqueOrThrow({
    where: { id: created.id },
    select: operatorSelect,
  });
  return { operator: toOperatorDto(ctx.env, operator), invite };
}
