import type { Env } from "../../config/env.js";
import type { AppContext } from "../../context.js";
import { isPlatformAdmin } from "../../http/platform-admin.js";
import type { AuthUser } from "../../integrations/auth/auth-admin.js";

export const operatorSelect = {
  id: true,
  email: true,
  supabaseUserId: true,
  archivedAt: true,
  invitedAt: true,
  inviteError: true,
  createdAt: true,
} as const;

export type OperatorRow = {
  id: string;
  email: string;
  supabaseUserId: string | null;
  archivedAt: Date | null;
  invitedAt: Date | null;
  inviteError: string | null;
  createdAt: Date;
};

export type OperatorAuthState = Pick<AuthUser, "confirmed" | "lastSignInAt">;

/** Best-effort lookup of the operator's auth confirmation & last sign-in; never breaks reads. */
export async function lookupOperatorAuth(
  ctx: AppContext,
  supabaseUserId: string | null,
): Promise<OperatorAuthState | null> {
  if (!supabaseUserId) return null;
  try {
    const user = await ctx.authAdmin.getUserById(supabaseUserId);
    return user
      ? { confirmed: user.confirmed, lastSignInAt: user.lastSignInAt }
      : null;
  } catch (error) {
    ctx.logger.warn(
      { err: error, supabaseUserId },
      "could not inspect operator auth user",
    );
    return null;
  }
}

/** The Supabase user id stays on the server; the panel only learns whether there is one. */
export function toOperatorDto(
  env: Pick<Env, "PLATFORM_ADMIN_EMAILS">,
  operator: OperatorRow,
  auth?: OperatorAuthState | null,
) {
  return {
    id: operator.id,
    email: operator.email,
    createdAt: operator.createdAt,
    archivedAt: operator.archivedAt,
    hasLogin: operator.supabaseUserId !== null,
    confirmed: auth?.confirmed ?? false,
    lastSignInAt: auth?.lastSignInAt ?? null,
    invitedAt: operator.invitedAt,
    inviteError: operator.inviteError,
    platformAdmin: isPlatformAdmin(env, operator.email),
  };
}

export type OperatorDto = ReturnType<typeof toOperatorDto>;
