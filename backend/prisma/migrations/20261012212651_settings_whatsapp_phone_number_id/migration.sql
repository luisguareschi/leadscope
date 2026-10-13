-- AlterEnum
ALTER TYPE "SettingsKind" ADD VALUE 'whatsappPhoneNumberId';

-- AlterTable
ALTER TABLE "CompanySettingsVersion" ADD COLUMN     "whatsappPhoneNumberId" TEXT;

-- Every company starts with one version of its WhatsApp phone number id, so its first change can be restored.
INSERT INTO "CompanySettingsVersion" ("id", "companyId", "kind", "whatsappPhoneNumberId")
SELECT gen_random_uuid()::text, "id", 'whatsappPhoneNumberId', "whatsappPhoneNumberId" FROM "Company";
