import {
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from "jose";

/**
 * Verifies a Supabase access token. Current projects sign sessions with ES256 and publish
 * the key on the project's JWKS. The legacy shared secret only verifies HS256 tokens.
 * Trying that secret first rejects every ES256 session, including a platform admin who
 * has no operator row yet.
 */
export async function verifySupabaseAccessToken(
  token: string,
  options: {
    issuer?: string;
    secret: Uint8Array | null;
    jwks: JWTVerifyGetKey | null;
  },
): Promise<JWTPayload> {
  const verifyOptions = {
    issuer: options.issuer,
    audience: "authenticated" as const,
  };
  let alg: string | undefined;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    alg = undefined;
  }

  if (options.secret && (alg === "HS256" || alg === undefined)) {
    try {
      return (await jwtVerify(token, options.secret, verifyOptions)).payload;
    } catch (error) {
      if (!options.jwks || alg === "HS256") throw error;
    }
  }
  if (options.jwks) {
    return (await jwtVerify(token, options.jwks, verifyOptions)).payload;
  }
  throw new Error("Supabase auth is not configured");
}
