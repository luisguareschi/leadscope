import type { Env } from "../../config/env.js";
import { isPlatformAdmin } from "../../http/platform-admin.js";

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

/** The Supabase user id stays on the server; the panel only learns whether there is one. */
export function toOperatorDto(
  env: Pick<Env, "PLATFORM_ADMIN_EMAILS">,
  operator: OperatorRow,
) {
  return {
    id: operator.id,
    email: operator.email,
    createdAt: operator.createdAt,
    archivedAt: operator.archivedAt,
    hasLogin: operator.supabaseUserId !== null,
    invitedAt: operator.invitedAt,
    inviteError: operator.inviteError,
    platformAdmin: isPlatformAdmin(env, operator.email),
  };
}

export type OperatorDto = ReturnType<typeof toOperatorDto>;
