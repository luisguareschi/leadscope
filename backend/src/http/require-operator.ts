import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { AppContext } from "../context.js";
import { HttpError } from "../lib/http-error.js";

export type OperatorAuth = { operatorId: string; companyId: string; email: string };

type RequestWithOperator = Request & { operator?: OperatorAuth };

export function operatorOf(req: Request): OperatorAuth {
  const operator = (req as RequestWithOperator).operator;
  if (!operator) throw new HttpError(401, "No autenticado", "unauthorized");
  return operator;
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() || null : null;
}

function createSupabaseVerifier(ctx: AppContext) {
  const { SUPABASE_URL, SUPABASE_JWT_SECRET } = ctx.env;
  const issuer = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1` : undefined;
  const jwks = issuer ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)) : null;
  const secret = SUPABASE_JWT_SECRET ? new TextEncoder().encode(SUPABASE_JWT_SECRET) : null;

  return async (token: string): Promise<JWTPayload> => {
    const options = { issuer, audience: "authenticated" };
    if (secret) return (await jwtVerify(token, secret, options)).payload;
    if (jwks) return (await jwtVerify(token, jwks, options)).payload;
    throw new Error("Supabase auth is not configured");
  };
}

/**
 * Resolves the operator (and so the company) behind a backoffice request. Every `/internal` query
 * filters by this company. Dev mode accepts `dev:<email>` and is refused in production by env validation.
 */
export function requireOperator(ctx: AppContext): RequestHandler {
  const verifySupabase = createSupabaseVerifier(ctx);

  async function resolve(token: string): Promise<OperatorAuth | null> {
    if (ctx.env.AUTH_MODE === "dev") {
      if (!token.startsWith("dev:")) return null;
      const operator = await ctx.db.operator.findUnique({ where: { email: token.slice(4).trim().toLowerCase() } });
      return operator ? { operatorId: operator.id, companyId: operator.companyId, email: operator.email } : null;
    }
    const payload = await verifySupabase(token);
    if (!payload.sub) return null;
    let operator = await ctx.db.operator.findUnique({ where: { supabaseUserId: payload.sub } });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
    if (!operator && email) {
      // First login of an operator Luis created by email: link the Supabase user to that row.
      const invited = await ctx.db.operator.findUnique({ where: { email } });
      if (invited && !invited.supabaseUserId) {
        operator = await ctx.db.operator.update({ where: { id: invited.id }, data: { supabaseUserId: payload.sub } });
      }
    }
    return operator ? { operatorId: operator.id, companyId: operator.companyId, email: operator.email } : null;
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) {
      res.status(401).json({ error: { code: "unauthorized", message: "No autenticado" } });
      return;
    }
    let operator: OperatorAuth | null;
    try {
      operator = await resolve(token);
    } catch {
      res.status(401).json({ error: { code: "unauthorized", message: "Sesión inválida o vencida" } });
      return;
    }
    if (!operator) {
      res.status(403).json({ error: { code: "forbidden", message: "Este usuario no tiene acceso al panel" } });
      return;
    }
    (req as RequestWithOperator).operator = operator;
    next();
  };
}
