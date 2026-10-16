import type { AppContext } from "../../context.js";
import {
  AuthAdminError,
  setPasswordUrl,
} from "../../integrations/auth/auth-admin.js";
import { reportError } from "../../lib/monitoring.js";
import { isUniqueViolation } from "../../lib/prisma.js";

/**
 * `sent`: invitation email. `linked`: that email already had a Supabase account with a password,
 * so it was linked and no email went out. `reset_sent`: a resend for such an account, which gets
 * the password-reset email instead (Supabase does not re-invite a confirmed user).
 */
export type InviteOutcome =
  | { status: "sent" | "linked" | "reset_sent" }
  | { status: "failed"; message: string };

/**
 * Creates (or finds) the operator's Supabase user and emails the link to /auth/set-password.
 * Never throws for a Supabase failure: the reason is saved on the row and returned, so the panel
 * can show it and offer a resend.
 */
export async function inviteOperator(
  ctx: AppContext,
  operator: { id: string; email: string },
  options: { resend: boolean },
): Promise<InviteOutcome> {
  const redirectTo = setPasswordUrl(ctx.env);
  let outcome: InviteOutcome;
  let userId: string | null = null;
  try {
    const result = await ctx.authAdmin.invite(operator.email, redirectTo);
    userId = result.userId;
    if (result.status === "invited") outcome = { status: "sent" };
    else if (options.resend) {
      await ctx.authAdmin.sendPasswordReset(operator.email, redirectTo);
      outcome = { status: "reset_sent" };
    } else outcome = { status: "linked" };
  } catch (error) {
    if (!(error instanceof AuthAdminError)) {
      ctx.logger.error(
        { err: error, operatorId: operator.id },
        "operator invite crashed",
      );
      reportError(error);
    }
    outcome = {
      status: "failed",
      message:
        error instanceof AuthAdminError
          ? error.message
          : "No se pudo enviar la invitación por un error inesperado. Probá de nuevo.",
    };
  }

  try {
    await ctx.db.operator.update({
      where: { id: operator.id },
      data:
        outcome.status === "failed"
          ? { inviteError: outcome.message }
          : {
              supabaseUserId: userId,
              inviteError: null,
              ...(outcome.status === "linked" ? {} : { invitedAt: ctx.now() }),
            },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    outcome = {
      status: "failed",
      message:
        "Ese usuario de Supabase ya está vinculado a otro operador, así que no se vinculó a este.",
    };
    await ctx.db.operator.update({
      where: { id: operator.id },
      data: { inviteError: outcome.message },
    });
  }
  if (outcome.status === "failed") {
    ctx.logger.warn(
      { operatorId: operator.id, reason: outcome.message },
      "operator invite failed",
    );
  }
  return outcome;
}
