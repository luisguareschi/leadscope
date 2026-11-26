import { createSupabaseAuthAdmin } from "../../src/integrations/auth/auth-admin.js";

export const SUPABASE_URL = "https://example.supabase.co";
export const SERVICE_ROLE_KEY = "service-role-test-key";

type StoredUser = {
  id: string;
  email: string;
  confirmed: boolean;
  lastSignInAt: string | null;
};

export type SupabaseCall = {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
};

/**
 * Stands in for Supabase's Auth admin endpoints (`/invite`, `/recover`, `/admin/users`), behaving
 * like GoTrue: inviting a confirmed email answers 422 `email_exists`. Every request is recorded.
 */
export function fakeSupabase() {
  const users = new Map<string, StoredUser>();
  const calls: SupabaseCall[] = [];
  let failNext: { status: number; body: unknown } | null = null;
  let counter = 0;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const call: SupabaseCall = {
      method: init?.method ?? "GET",
      path: url.pathname.replace(/^\/auth\/v1/, ""),
      query: url.searchParams,
      headers: Object.fromEntries(
        Object.entries((init?.headers ?? {}) as Record<string, string>),
      ),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    if (failNext) {
      const failure = failNext;
      failNext = null;
      return json(failure.status, failure.body);
    }
    const byEmail = (email: string) =>
      [...users.values()].find((user) => user.email === email.toLowerCase());

    if (call.method === "POST" && call.path === "/invite") {
      const email = String((call.body as { email: string }).email);
      const existing = byEmail(email);
      if (existing?.confirmed)
        return json(422, {
          code: 422,
          error_code: "email_exists",
          msg: "A user with this email address has already been registered",
        });
      const user = existing ?? {
        id: `sb-user-${(counter += 1)}`,
        email: email.toLowerCase(),
        confirmed: false,
        lastSignInAt: null,
      };
      users.set(user.id, user);
      return json(200, { id: user.id, email: user.email });
    }
    if (call.method === "POST" && call.path === "/recover")
      return json(200, {});
    if (call.method === "GET" && call.path === "/admin/users") {
      const filter = (call.query.get("filter") ?? "").toLowerCase();
      return json(200, {
        users: [...users.values()]
          .filter((user) => user.email.includes(filter))
          .map((user) => ({
            id: user.id,
            email: user.email,
            email_confirmed_at: user.confirmed ? "2026-01-01T00:00:00Z" : null,
            last_sign_in_at: user.lastSignInAt,
          })),
      });
    }
    const byId = /^\/admin\/users\/(.+)$/.exec(call.path);
    if (call.method === "GET" && byId) {
      const id = decodeURIComponent(byId[1] ?? "");
      const user = users.get(id);
      if (!user) return json(404, { msg: "User not found" });
      return json(200, {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.confirmed ? "2026-01-01T00:00:00Z" : null,
        last_sign_in_at: user.lastSignInAt,
      });
    }
    if (call.method === "DELETE" && byId) {
      const id = decodeURIComponent(byId[1] ?? "");
      if (!users.delete(id)) return json(404, { msg: "User not found" });
      return json(200, {});
    }
    return json(404, { msg: "not found" });
  };

  return {
    users,
    calls,
    authAdmin: createSupabaseAuthAdmin({
      url: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      fetch: fetchImpl,
    }),
    /** A user who already signed up and set a password. */
    addConfirmedUser(
      email: string,
      lastSignInAt: string | null = "2026-11-20T12:00:00Z",
    ): string {
      const id = `sb-existing-${(counter += 1)}`;
      users.set(id, {
        id,
        email: email.toLowerCase(),
        confirmed: true,
        lastSignInAt,
      });
      return id;
    },
    confirmUser(
      userId: string,
      lastSignInAt: string | null = "2026-11-26T15:00:00Z",
    ) {
      const user = users.get(userId);
      if (user) {
        user.confirmed = true;
        user.lastSignInAt = lastSignInAt;
      }
    },
    failNextWith(status: number, body: unknown) {
      failNext = { status, body };
    },
  };
}
