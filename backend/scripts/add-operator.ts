/**
 * Gives someone access to a company's backoffice:
 *   npm run operator:add -- <companySlug> <email> [--invite]
 * Without --invite the operator signs in once their Supabase user exists (linked by email on first
 * login). With --invite, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are used to email them an
 * invitation that lands on the backoffice's "set your password" page.
 */
import { parseArgs } from "node:util";
import { loadEnv } from "../src/config/env.js";
import { createPrisma } from "../src/lib/prisma.js";

async function inviteToSupabase(url: string, serviceRoleKey: string, email: string, redirectTo: string): Promise<string> {
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const json = (await response.json().catch(() => ({}))) as { id?: string; msg?: string; message?: string };
  if (!response.ok || !json.id) throw new Error(`Supabase invite failed: ${json.msg ?? json.message ?? response.status}`);
  return json.id;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { invite: { type: "boolean", default: false } } });
  const [slug, rawEmail] = positionals;
  if (!slug || !rawEmail) throw new Error("Usage: npm run operator:add -- <companySlug> <email> [--invite]");
  const email = rawEmail.trim().toLowerCase();
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  const company = await db.company.findUnique({ where: { slug } });
  if (!company) throw new Error(`No company with slug "${slug}"`);

  let supabaseUserId: string | undefined;
  if (values.invite) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("--invite needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    }
    supabaseUserId = await inviteToSupabase(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      email,
      `${env.BACKOFFICE_ORIGIN}/auth/set-password`,
    );
  }
  const operator = await db.operator.upsert({
    where: { email },
    create: { email, companyId: company.id, supabaseUserId },
    update: { companyId: company.id, ...(supabaseUserId ? { supabaseUserId } : {}) },
  });
  console.log(`Operator ${operator.email} can now use the ${company.name} backoffice${values.invite ? " (invitation sent)" : ""}.`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
