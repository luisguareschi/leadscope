import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createRemoteJWKSet, errors, type JWTPayload } from "jose";
import type { AppContext } from "../context.js";
import { HttpError } from "../lib/http-error.js";
import { verifySupabaseAccessToken } from "./supabase-jwt.js";

export type OperatorAuth = {
  operatorId: string;
  companyId: string;
  /** Email stored on the operator row. */
  email: string;
  /** Email on the signed-in session: the Supabase JWT, or the `dev:` token. */
  sessionEmail: string;
};

/** A verified panel login. `operator` is null when that email has no operator row yet. */
export type PanelSession = {
  sessionEmail: string;
  operator: OperatorAuth | null;
};

type RequestWithSession = Request & {
  session?: PanelSession;
  operator?: OperatorAuth;
};

export function sessionOf(req: Request): PanelSession {
  const session = (req as RequestWithSession).session;
  if (!session) throw new HttpError(401, "No autenticado", "unauthorized");
  return session;
}

export function operatorOf(req: Request): OperatorAuth {
  const operator = (req as RequestWithSession).operator;
  if (!operator) throw new HttpError(401, "No autenticado", "unauthorized");
  return operator;
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}

function createSupabaseVerifier(ctx: AppContext) {
  const { SUPABASE_URL, SUPABASE_JWT_SECRET } = ctx.env;
  const issuer = SUPABASE_URL
    ? `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1`
    : undefined;
  const jwks = issuer
    ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
    : null;
  const secret = SUPABASE_JWT_SECRET
    ? new TextEncoder().encode(SUPABASE_JWT_SECRET)
    : null;

  return (token: string): Promise<JWTPayload> =>
    verifySupabaseAccessToken(token, { issuer, secret, jwks });
}

function isRejectedSupabaseSession(error: unknown): boolean {
  return (
    error instanceof errors.JOSEError ||
    (error instanceof Error &&
      error.message === "Supabase auth is not configured")
  );
}

const noPanelAccess = {
  error: {
    code: "forbidden",
    message: "Este usuario no tiene acceso al panel",
  },
} as const;

/**
 * Verifies the panel login and attaches the session. A platform admin may have no operator row.
 * Dev mode accepts `dev:<email>` and is refused in production by env validation.
 */
export function requireSession(ctx: AppContext): RequestHandler {
  const verifySupabase = createSupabaseVerifier(ctx);

  async function resolve(token: string): Promise<PanelSession | null> {
    if (ctx.env.AUTH_MODE === "dev") {
      if (!token.startsWith("dev:")) return null;
      const sessionEmail = token.slice(4).trim().toLowerCase();
      if (!sessionEmail) return null;
      const operator = await ctx.db.operator.findUnique({
        where: { email: sessionEmail },
      });
      return {
        sessionEmail,
        operator: operator
          ? {
              operatorId: operator.id,
              companyId: operator.companyId,
              email: operator.email,
              sessionEmail,
            }
          : null,
      };
    }
    const payload = await verifySupabase(token);
    if (!payload.sub) return null;
    let operator = await ctx.db.operator.findUnique({
      where: { supabaseUserId: payload.sub },
    });
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : null;
    if (!operator && email) {
      // First login of an operator created by email: link the Supabase user to that row.
      const invited = await ctx.db.operator.findUnique({ where: { email } });
      if (invited && !invited.supabaseUserId) {
        operator = await ctx.db.operator.update({
          where: { id: invited.id },
          data: { supabaseUserId: payload.sub },
        });
      }
    }
    const sessionEmail = email ?? operator?.email ?? null;
    if (!sessionEmail) return null;
    return {
      sessionEmail,
      operator: operator
        ? {
            operatorId: operator.id,
            companyId: operator.companyId,
            email: operator.email,
            sessionEmail,
          }
        : null,
    };
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) {
      res
        .status(401)
        .json({ error: { code: "unauthorized", message: "No autenticado" } });
      return;
    }
    let session: PanelSession | null;
    try {
      session = await resolve(token);
    } catch (error) {
      // Only a rejected Supabase JWT. A missing operator row is not an error here.
      if (!isRejectedSupabaseSession(error)) throw error;
      ctx.logger.warn({ err: error }, "supabase session rejected");
      res.status(401).json({
        error: { code: "unauthorized", message: "Sesión inválida o vencida" },
      });
      return;
    }
    if (!session) {
      res.status(403).json(noPanelAccess);
      return;
    }
    const withSession = req as RequestWithSession;
    withSession.session = session;
    if (session.operator) withSession.operator = session.operator;
    next();
  };
}

/** Company routes. A signed-in platform admin with no operator row stops here. */
export function requireOperator(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!sessionOf(req).operator) {
      res.status(403).json(noPanelAccess);
      return;
    }
    next();
  };
}
