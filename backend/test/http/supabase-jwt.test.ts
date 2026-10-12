import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { verifySupabaseAccessToken } from "../../src/http/supabase-jwt.js";

const issuer = "https://example.supabase.co/auth/v1";
const hsSecret = new TextEncoder().encode("legacy-hs256-secret-that-is-32b!!");

async function hs256Token(email: string) {
  return new SignJWT({ email, role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-hs")
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(hsSecret);
}

async function es256Token(email: string) {
  const { publicKey, privateKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const jwk = await exportJWK(publicKey);
  jwk.alg = "ES256";
  jwk.kid = "test-key";
  jwk.use = "sig";
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const token = await new SignJWT({ email, role: "authenticated" })
    .setProtectedHeader({ alg: "ES256", kid: "test-key" })
    .setSubject("user-es")
    .setIssuer(issuer)
    .setAudience("authenticated")
    .setExpirationTime("1h")
    .sign(privateKey);
  return { token, jwks };
}

describe("supabase access tokens", () => {
  it("verifies an HS256 token with the legacy secret", async () => {
    const token = await hs256Token("admin@admin.com");
    const payload = await verifySupabaseAccessToken(token, {
      issuer,
      secret: hsSecret,
      jwks: null,
    });
    expect(payload.email).toBe("admin@admin.com");
    expect(payload.sub).toBe("user-hs");
  });

  it("verifies an ES256 token with JWKS even when the legacy secret is set", async () => {
    const { token, jwks } = await es256Token("admin@admin.com");
    const payload = await verifySupabaseAccessToken(token, {
      issuer,
      secret: hsSecret,
      jwks,
    });
    expect(payload.email).toBe("admin@admin.com");
    expect(payload.sub).toBe("user-es");
  });

  it("rejects an ES256 token when only the legacy secret is configured", async () => {
    const { token } = await es256Token("admin@admin.com");
    await expect(
      verifySupabaseAccessToken(token, {
        issuer,
        secret: hsSecret,
        jwks: null,
      }),
    ).rejects.toThrow(/not configured|signature|alg/i);
  });
});
