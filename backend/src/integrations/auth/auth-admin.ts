import type { Env } from "../../config/env.js";

export type AuthUser = { id: string; email: string; confirmed: boolean };

/** `existing`: that email already had a confirmed account, so no invitation was sent. */
export type InviteResult = {
  status: "invited" | "existing";
  userId: string;
};

/** The message is in Spanish: the panel shows it as is. */
export class AuthAdminError extends Error {}

/**
 * Server-side management of panel logins. In production it is Supabase's admin API with the
 * service role key, which never leaves the server.
 */
export interface AuthAdmin {
  /** Sends the invitation email. An unconfirmed user gets it again; a confirmed one is returned. */
  invite(email: string, redirectTo: string): Promise<InviteResult>;
  /** Sends the password-reset email. Its link lands on the same page as the invitation. */
  sendPasswordReset(email: string, redirectTo: string): Promise<void>;
  findUserByEmail(email: string): Promise<AuthUser | null>;
  /** A user that no longer exists is not an error. */
  deleteUser(userId: string): Promise<void>;
}

type Fetch = typeof fetch;

type GoTrueError = {
  code?: number | string;
  error_code?: string;
  msg?: string;
  message?: string;
  error_description?: string;
};

type GoTrueUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

function toAuthUser(user: GoTrueUser): AuthUser {
  return {
    id: user.id,
    email: (user.email ?? "").toLowerCase(),
    confirmed: Boolean(user.email_confirmed_at ?? user.confirmed_at),
  };
}

function detailOf(body: GoTrueError | null): string {
  return (
    body?.msg ??
    body?.message ??
    body?.error_description ??
    body?.error_code ??
    ""
  );
}

function isEmailTaken(status: number, body: GoTrueError | null): boolean {
  return (
    status === 422 &&
    (body?.error_code === "email_exists" ||
      /already (been )?registered/i.test(detailOf(body)))
  );
}

function spanishFailure(
  what: string,
  status: number,
  body: GoTrueError | null,
): AuthAdminError {
  if (status === 429 || body?.error_code === "over_email_send_rate_limit")
    return new AuthAdminError(
      `Supabase no envió ${what}: se alcanzó el límite de emails por hora. Probá de nuevo más tarde.`,
    );
  if (status === 401 || status === 403)
    return new AuthAdminError(
      `Supabase rechazó la clave de servicio, así que no se envió ${what}. Revisá SUPABASE_SERVICE_ROLE_KEY en el servidor.`,
    );
  const detail = detailOf(body);
  return new AuthAdminError(
    `Supabase no envió ${what}${detail ? `: ${detail}` : ` (error ${status})`}.`,
  );
}

export function createSupabaseAuthAdmin(options: {
  url: string;
  serviceRoleKey: string;
  fetch?: Fetch;
}): AuthAdmin {
  const base = `${options.url.replace(/\/$/, "")}/auth/v1`;
  const doFetch = options.fetch ?? fetch;
  const headers = {
    apikey: options.serviceRoleKey,
    Authorization: `Bearer ${options.serviceRoleKey}`,
    "Content-Type": "application/json",
  };

  async function call(
    path: string,
    init: { method: string; body?: unknown },
  ): Promise<{ status: number; ok: boolean; json: unknown }> {
    let response: Response;
    try {
      response = await doFetch(`${base}${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new AuthAdminError(
        "No se pudo conectar con Supabase. Probá de nuevo en un momento.",
      );
    }
    const json: unknown = await response.json().catch(() => null);
    return { status: response.status, ok: response.ok, json };
  }

  async function findUserByEmail(email: string): Promise<AuthUser | null> {
    const wanted = email.trim().toLowerCase();
    // `filter` narrows by a substring of the email, so one page is enough; the exact match is ours.
    for (let page = 1; page <= 5; page += 1) {
      const result = await call(
        `/admin/users?filter=${encodeURIComponent(wanted)}&page=${page}&per_page=100`,
        { method: "GET" },
      );
      if (!result.ok)
        throw spanishFailure(
          "la búsqueda del usuario",
          result.status,
          result.json as GoTrueError | null,
        );
      const users = (result.json as { users?: GoTrueUser[] } | null)?.users;
      if (!users?.length) return null;
      const match = users.find(
        (user) => (user.email ?? "").toLowerCase() === wanted,
      );
      if (match) return toAuthUser(match);
      if (users.length < 100) return null;
    }
    return null;
  }

  return {
    findUserByEmail,

    async invite(email, redirectTo) {
      const result = await call(
        `/invite?redirect_to=${encodeURIComponent(redirectTo)}`,
        { method: "POST", body: { email } },
      );
      const body = result.json as (GoTrueUser & GoTrueError) | null;
      if (result.ok && body?.id) return { status: "invited", userId: body.id };
      if (isEmailTaken(result.status, body)) {
        const existing = await findUserByEmail(email);
        if (existing) return { status: "existing", userId: existing.id };
      }
      throw spanishFailure("la invitación", result.status, body);
    },

    async sendPasswordReset(email, redirectTo) {
      const result = await call(
        `/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
        { method: "POST", body: { email } },
      );
      if (!result.ok)
        throw spanishFailure(
          "el email para elegir contraseña",
          result.status,
          result.json as GoTrueError | null,
        );
    },

    async deleteUser(userId) {
      const result = await call(`/admin/users/${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (result.ok || result.status === 404) return;
      throw spanishFailure(
        "la baja del usuario",
        result.status,
        result.json as GoTrueError | null,
      );
    },
  };
}

/** Development login (`AUTH_MODE=dev`): users live in memory and no email leaves the process. */
export class FakeAuthAdmin implements AuthAdmin {
  readonly users = new Map<string, AuthUser>();
  readonly sent: Array<{
    kind: "invite" | "reset";
    email: string;
    redirectTo: string;
  }> = [];
  private counter = 0;

  async invite(email: string, redirectTo: string): Promise<InviteResult> {
    const existing = await this.findUserByEmail(email);
    if (existing?.confirmed) return { status: "existing", userId: existing.id };
    const user = existing ?? {
      id: `fake-user-${(this.counter += 1)}`,
      email: email.toLowerCase(),
      confirmed: false,
    };
    this.users.set(user.id, user);
    this.sent.push({ kind: "invite", email: user.email, redirectTo });
    return { status: "invited", userId: user.id };
  }

  async sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    this.sent.push({ kind: "reset", email: email.toLowerCase(), redirectTo });
  }

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const wanted = email.toLowerCase();
    return [...this.users.values()].find((u) => u.email === wanted) ?? null;
  }

  async deleteUser(userId: string): Promise<void> {
    this.users.delete(userId);
  }
}

class UnconfiguredAuthAdmin implements AuthAdmin {
  private fail(): never {
    throw new AuthAdminError(
      "El servidor no tiene SUPABASE_SERVICE_ROLE_KEY, así que no puede crear usuarios ni enviar invitaciones.",
    );
  }
  async invite(): Promise<InviteResult> {
    this.fail();
  }
  async sendPasswordReset(): Promise<void> {
    this.fail();
  }
  async findUserByEmail(): Promise<AuthUser | null> {
    this.fail();
  }
  async deleteUser(): Promise<void> {
    this.fail();
  }
}

export function createAuthAdmin(env: Env): AuthAdmin {
  if (env.AUTH_MODE === "dev") return new FakeAuthAdmin();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    return new UnconfiguredAuthAdmin();
  return createSupabaseAuthAdmin({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
}
