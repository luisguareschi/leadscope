import { PrismaClient } from "@prisma/client";
import { encryptSecrets } from "../crypto/secrets";
import { syncSheetForCompany } from "../services/knowledge.service";
import { altamiraConfig, altamiraDevSecrets } from "./altamira";
import { readCompany } from "./load";

export async function seedAltamira(
  db: PrismaClient,
  key: Buffer,
  operator: { email: string; supabaseUserId: string },
): Promise<void> {
  const config = altamiraConfig();
  const company = await db.company.upsert({
    where: { whatsappPhoneNumberId: config.whatsapp.phoneNumberId },
    create: {
      name: "Altamira",
      config,
      encryptedSecrets: encryptSecrets(altamiraDevSecrets(), key),
      whatsappPhoneNumberId: config.whatsapp.phoneNumberId,
    },
    update: {
      name: "Altamira",
      config,
      encryptedSecrets: encryptSecrets(altamiraDevSecrets(), key),
    },
  });
  await db.operator.upsert({
    where: { supabaseUserId: operator.supabaseUserId },
    create: {
      companyId: company.id,
      email: operator.email,
      supabaseUserId: operator.supabaseUserId,
    },
    update: { email: operator.email, companyId: company.id },
  });
  await syncSheetForCompany(db, readCompany(company, key), "");
}
