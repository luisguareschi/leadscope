import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Env } from "../env";

export type OperatorSession = {
  id: string;
  companyId: string;
  supabaseUserId: string;
  email: string;
};

export type AuthedRequest = Request & { operator?: OperatorSession };

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function supabaseUserId(token: string, env: Env): Promise<string> {
  if (env.SUPABASE_JWT_SECRET) {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET));
    if (!payload.sub) throw new Error("missing sub");
    return payload.sub;
  }
  if (!env.SUPABASE_URL) throw new Error("Supabase auth is not configured");
  jwks ??= createRemoteJWKSet(new URL(`${env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks);
  if (!payload.sub) throw new Error("missing sub");
  return payload.sub;
}

export function requireOperator(db: PrismaClient, env: Env) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    const header = req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }
    try {
      if (env.AUTH_MODE === "fake") {
        if (env.NODE_ENV === "production") {
          res.status(401).json({ error: "unauthorized" });
          return;
        }
        if (!token.startsWith("fake:")) {
          res.status(401).json({ error: "unauthorized" });
          return;
        }
        const operator = await db.operator.findFirst({ where: { email: token.slice(5) } });
        if (!operator) {
          res.status(401).json({ error: "unauthorized" });
          return;
        }
        req.operator = operator;
        next();
        return;
      }
      const userId = await supabaseUserId(token, env);
      const operator = await db.operator.findUnique({ where: { supabaseUserId: userId } });
      if (!operator) {
        res.status(403).json({ error: "no operator for this login" });
        return;
      }
      req.operator = operator;
      next();
    } catch {
      res.status(401).json({ error: "unauthorized" });
    }
  };
}
