import { PrismaClient } from "@prisma/client";
import { seedAltamira } from "../src/companies/seed";
import { decodeEncryptionKey } from "../src/crypto/secrets";
import { loadEnv } from "../src/env";
import { PrismaStore } from "../src/store/prisma";

async function main(): Promise<void> {
  const env = loadEnv();
  if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required to seed");
  if (!env.SECRETS_ENCRYPTION_KEY) throw new Error("SECRETS_ENCRYPTION_KEY is required to seed");
  const db = new PrismaClient();
  const store = new PrismaStore(db, decodeEncryptionKey(env.SECRETS_ENCRYPTION_KEY));
  await seedAltamira(store, {
    email: env.SEED_OPERATOR_EMAIL,
    supabaseUserId: env.SEED_OPERATOR_SUPABASE_USER_ID,
  });
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
