import type { NextFunction, Request, RequestHandler, Response } from "express";
import { createRemoteJWKSet, customFetch, errors, type JWTPayload } from "jose";
import type { AppContext } from "../context.js";
import { HttpError } from "../lib/http-error.js";
import { createLoggedFetch } from "../lib/logged-fetch.js";
import { isUniqueViolation } from "../lib/prisma.js";
import { verifySupabaseAccessToken } from "./supabase-jwt.js";

/** One company the signed-in login is an operator of: its operator row and that company. */
export type OperatorMembership = {
  operatorId: string;
  companyId: string;
  companyName: string;
  companySlug: string;
  companyAssistantPaused: boolean;
  companyAssistantPausedAt: Date | null;
  companyAssistantPausedByEmail: string | null;
  /** Email stored on the operator row. */
  email: string;
  /** The operator row is archived. */
  archived: boolean;
  /** The company is archived. */
  companyArchived: boolean;
  createdAt: Date;
};

const membershipSelect = {
  id: true,
  companyId: true,
  email: true,
  archivedAt: true,
  createdAt: true,
  company: {
    select: {
      name: true,
      slug: true,
      archivedAt: true,
      assistantPaused: true,
      assistantPausedAt: true,
      assistantPausedByEmail: true,
    },
  },
} as const;

type MembershipRow = {
  id: string;
  companyId: string;
  email: string;
  archivedAt: Date | null;
  createdAt: Date;
  company: {
    name: string;
    slug: string;
    archivedAt: Date | null;
    assistantPaused: boolean;
    assistantPausedAt: Date | null;
    assistantPausedByEmail: string | null;
  };
};

function toMembership(row: MembershipRow): OperatorMembership {
  return {
    operatorId: row.id,
    companyId: row.companyId,
    companyName: row.company.name,
    companySlug: row.company.slug,
    companyAssistantPaused: row.company.assistantPaused,
    companyAssistantPausedAt: row.company.assistantPausedAt,
    companyAssistantPausedByEmail: row.company.assistantPausedByEmail,
    email: row.email,
    archived: row.archivedAt !== null,
    companyArchived: row.company.archivedAt !== null,
    createdAt: row.createdAt,
  };
}

async function findMembershipsByEmail(
  ctx: AppContext,
  email: string,
): Promise<OperatorMembership[]> {
  const rows = await ctx.db.operator.findMany({
    where: { email },
    select: membershipSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toMembership);
}

/**
 * A verified panel login and every company it is an operator of, oldest membership first. Empty
 * when it has no operator row (a platform admin may have none).
 */
export type PanelSession = {
  /** Email on the signed-in session: the Supabase JWT, or the `dev:` token. */
  sessionEmail: string;
  memberships: OperatorMembership[];
};

type RequestWithSession = Request & { session?: PanelSession };

export function sessionOf(req: Request): PanelSession {
  const session = (req as RequestWithSession).session;
  if (!session) throw new HttpError(401, "No autenticado", "unauthorized");
  return session;
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
    ? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
        [customFetch]: createLoggedFetch(ctx.logger, "supabase-jwks"),
      })
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

export const noPanelAccess = {
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
      return {
        sessionEmail,
        memberships: await findMembershipsByEmail(ctx, sessionEmail),
      };
    }
    const payload = await verifySupabase(token);
    if (!payload.sub) return null;
    const supabaseUserId = payload.sub;
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : null;
    const rows = await ctx.db.operator.findMany({
      where: email
        ? { OR: [{ supabaseUserId }, { email, supabaseUserId: null }] }
        : { supabaseUserId },
      select: { ...membershipSelect, supabaseUserId: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const linkedCompanies = new Set(
      rows
        .filter((row) => row.supabaseUserId === supabaseUserId)
        .map((row) => row.companyId),
    );
    const toLinkIds = rows
      .filter(
        (row) =>
          row.supabaseUserId === null && !linkedCompanies.has(row.companyId),
      )
      .map((row) => row.id);
    let reread = false;
    if (toLinkIds.length > 0) {
      try {
        const updated = await ctx.db.operator.updateMany({
          where: { id: { in: toLinkIds }, supabaseUserId: null },
          data: { supabaseUserId },
        });
        if (updated.count < toLinkIds.length) reread = true;
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        reread = true;
      }
    }
    const memberships = reread
      ? (
          await ctx.db.operator.findMany({
            where: { supabaseUserId },
            select: membershipSelect,
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          })
        ).map(toMembership)
      : (() => {
          const linkedIdSet = new Set(toLinkIds);
          return rows
            .filter(
              (row) =>
                row.supabaseUserId === supabaseUserId ||
                linkedIdSet.has(row.id),
            )
            .map(toMembership);
        })();
    const sessionEmail = email ?? memberships[0]?.email ?? null;
    if (!sessionEmail) return null;
    return { sessionEmail, memberships };
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
        error: { code: "unauthorized", message: "Sesión inválida o expirada" },
      });
      return;
    }
    if (!session) {
      res.status(403).json(noPanelAccess);
      return;
    }
    (req as RequestWithSession).session = session;
    next();
  };
}
