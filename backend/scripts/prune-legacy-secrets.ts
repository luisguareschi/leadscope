/**
 * Removes secrets nothing reads anymore (the Meta access token from before Kapso) from every
 * company's encrypted payload. Other secrets are kept as they are.
 *   npm run secrets:prune             (lists what would change)
 *   npm run secrets:prune -- --apply  (rewrites those companies)
 */
import {
  decryptSecrets,
  encryptSecrets,
  legacySecretsIn,
} from "../src/companies/company-secrets.js";
import { loadEnv } from "../src/config/env.js";
import { parseEncryptionKey } from "../src/lib/crypto.js";
import { createPrisma } from "../src/lib/prisma.js";

async function main() {
  const apply = process.argv.includes("--apply");
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  const key = parseEncryptionKey(env.SECRETS_ENCRYPTION_KEY);
  try {
    const companies = await db.company.findMany({
      where: { encryptedSecrets: { not: null } },
      select: { id: true, slug: true, encryptedSecrets: true },
    });
    let changed = 0;
    for (const company of companies) {
      const legacy = legacySecretsIn(company.encryptedSecrets, key);
      if (legacy.length === 0) continue;
      changed += 1;
      console.log(`${company.slug}: ${legacy.join(", ")}`);
      if (!apply) continue;
      await db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ encryptedSecrets: string | null }>
        >`SELECT "encryptedSecrets" FROM "Company" WHERE "id" = ${company.id} FOR UPDATE`;
        const secrets = decryptSecrets(
          locked[0]?.encryptedSecrets ?? null,
          key,
        );
        await tx.company.update({
          where: { id: company.id },
          data: { encryptedSecrets: encryptSecrets(secrets, key) },
        });
      });
    }
    console.log(
      changed === 0
        ? "No legacy secrets."
        : apply
          ? `Pruned ${changed} compan${changed === 1 ? "y" : "ies"}.`
          : `${changed} compan${changed === 1 ? "y has" : "ies have"} legacy secrets. Run with --apply to remove them.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
