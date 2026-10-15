/**
 * Local fixture only. A production setup does not run this. Operators are added from Empresas,
 * which also creates their Supabase user and emails the invitation.
 *
 *   npm run operator:add -- <companySlug> <email> [--invite]
 * Without --invite the operator signs in once their Supabase user exists (linked by email on first
 * login). With --invite, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are used to email them an
 * invitation that lands on the backoffice's "set your password" page.
 */
import { parseArgs } from "node:util";
import { loadEnv } from "../src/config/env.js";
import {
  createSupabaseAuthAdmin,
  setPasswordUrl,
} from "../src/integrations/auth/auth-admin.js";
import { createPrisma } from "../src/lib/prisma.js";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "operator:add is a local fixture. A production setup does not run it. Operators are added from Empresas.",
    );
  }
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { invite: { type: "boolean", default: false } },
  });
  const [slug, rawEmail] = positionals;
  if (!slug || !rawEmail)
    throw new Error(
      "Usage: npm run operator:add -- <companySlug> <email> [--invite]",
    );
  const email = rawEmail.trim().toLowerCase();
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  const company = await db.company.findUnique({ where: { slug } });
  if (!company) throw new Error(`No company with slug "${slug}"`);

  let supabaseUserId: string | undefined;
  if (values.invite) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        "--invite needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
      );
    }
    const invited = await createSupabaseAuthAdmin({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    }).invite(email, setPasswordUrl(env));
    supabaseUserId = invited.userId;
  }
  const operator = await db.operator.upsert({
    where: { email },
    create: {
      email,
      companyId: company.id,
      supabaseUserId,
      ...(supabaseUserId ? { invitedAt: new Date() } : {}),
    },
    update: {
      companyId: company.id,
      ...(supabaseUserId ? { supabaseUserId, invitedAt: new Date() } : {}),
    },
  });
  console.log(
    `Operator ${operator.email} can now use the ${company.name} backoffice${values.invite ? " (invitation sent)" : ""}.`,
  );
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
