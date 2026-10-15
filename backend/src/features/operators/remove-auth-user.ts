import type { AppContext } from "../../context.js";
import { isPlatformAdmin } from "../../http/platform-admin.js";
import { AuthAdminError } from "../../integrations/auth/auth-admin.js";

export type AuthUserRemoval =
  | { status: "removed" | "kept_platform_admin" | "kept_operator" | "none" }
  | { status: "failed"; message: string };

/**
 * After an operator row is gone: deletes its Supabase user, unless that login is still an operator
 * somewhere or is on `PLATFORM_ADMIN_EMAILS`. A failure is reported, not thrown: the row is
 * already deleted and the user can be removed by hand in Supabase.
 */
export async function removeAuthUserIfUnused(
  ctx: AppContext,
  operator: { email: string; supabaseUserId: string | null },
): Promise<AuthUserRemoval> {
  if (isPlatformAdmin(ctx.env, operator.email))
    return { status: "kept_platform_admin" };
  const stillOperator = await ctx.db.operator.count({
    where: {
      OR: [
        { email: operator.email },
        ...(operator.supabaseUserId
          ? [{ supabaseUserId: operator.supabaseUserId }]
          : []),
      ],
    },
  });
  if (stillOperator > 0) return { status: "kept_operator" };
  try {
    const userId =
      operator.supabaseUserId ??
      (await ctx.authAdmin.findUserByEmail(operator.email))?.id;
    if (!userId) return { status: "none" };
    await ctx.authAdmin.deleteUser(userId);
    return { status: "removed" };
  } catch (error) {
    ctx.logger.warn(
      { err: error, email: operator.email },
      "supabase user not removed",
    );
    return {
      status: "failed",
      message:
        error instanceof AuthAdminError
          ? error.message
          : "No se pudo quitar el usuario de Supabase.",
    };
  }
}
