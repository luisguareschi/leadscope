import type { RequestHandler } from "express";
import type { Env } from "../config/env.js";
import type { AppContext } from "../context.js";
import { sessionOf } from "./require-session.js";

/** Comma-separated allowlist. Comparison is trimmed and lower-case. An empty list means nobody. */
export function platformAdminEmails(raw: string): Set<string> {
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

export function isPlatformAdmin(
  env: Pick<Env, "PLATFORM_ADMIN_EMAILS">,
  email: string,
): boolean {
  return platformAdminEmails(env.PLATFORM_ADMIN_EMAILS).has(
    email.trim().toLowerCase(),
  );
}

/**
 * After `requireSession`. The signed-in email (Supabase JWT, or the dev token) must be on
 * `PLATFORM_ADMIN_EMAILS`. No operator row is required. A company operator who is not on
 * the list gets 403.
 */
export function requirePlatformAdmin(ctx: AppContext): RequestHandler {
  return (req, res, next) => {
    const session = sessionOf(req);
    if (!isPlatformAdmin(ctx.env, session.sessionEmail)) {
      res.status(403).json({
        error: {
          code: "forbidden",
          message: "No tenés permiso para administrar empresas.",
        },
      });
      return;
    }
    next();
  };
}
