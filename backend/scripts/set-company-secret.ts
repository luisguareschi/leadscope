/**
 * Stores one of a company's API keys, encrypted on its Company row:
 *   npm run company:secret -- <companySlug> <name> <value>
 *   npm run company:secret -- <companySlug> <name> -          (reads the value from stdin)
 *   npm run company:secret -- <companySlug> <name> --delete
 * Names: anthropicApiKey, metaAccessToken, hubspotAccessToken, formLeadSecret.
 */
import { text } from "node:stream/consumers";
import { COMPANY_SECRET_NAMES, decryptSecrets, encryptSecrets, type CompanySecretName } from "../src/companies/company-secrets.js";
import { loadEnv } from "../src/config/env.js";
import { parseEncryptionKey } from "../src/lib/crypto.js";
import { createPrisma } from "../src/lib/prisma.js";

async function main() {
  const [slug, name, rawValue] = process.argv.slice(2);
  if (!slug || !name || !rawValue || !COMPANY_SECRET_NAMES.includes(name as CompanySecretName)) {
    throw new Error(`Usage: npm run company:secret -- <companySlug> <${COMPANY_SECRET_NAMES.join("|")}> <value|-|--delete>`);
  }
  const env = loadEnv();
  const db = createPrisma(env.DATABASE_URL);
  const key = parseEncryptionKey(env.SECRETS_ENCRYPTION_KEY);
  const company = await db.company.findUnique({ where: { slug } });
  if (!company) throw new Error(`No company with slug "${slug}"`);

  const secrets = decryptSecrets(company.encryptedSecrets, key);
  const secretName = name as CompanySecretName;
  if (rawValue === "--delete") {
    delete secrets[secretName];
  } else {
    const value = (rawValue === "-" ? await text(process.stdin) : rawValue).trim();
    if (!value) throw new Error("Empty value");
    secrets[secretName] = value;
  }
  await db.company.update({ where: { id: company.id }, data: { encryptedSecrets: encryptSecrets(secrets, key) } });
  const stored = secrets[secretName];
  console.log(stored ? `Stored ${secretName} for ${slug} (…${stored.slice(-4)})` : `Deleted ${secretName} for ${slug}`);
  await db.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
