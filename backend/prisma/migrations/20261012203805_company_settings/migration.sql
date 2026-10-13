-- CreateEnum
CREATE TYPE "SettingsKind" AS ENUM ('config', 'instructions');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "instructions" TEXT NOT NULL DEFAULT '';

-- The free-text "about" leaves the config and becomes the start of the company instructions.
UPDATE "Company"
SET "instructions" = COALESCE("config"->>'about', ''),
    "config" = "config" - 'about';

-- CreateTable
CREATE TABLE "CompanySettingsVersion" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "SettingsKind" NOT NULL,
    "config" JSONB,
    "instructions" TEXT,
    "createdByEmail" TEXT,
    "viaSupport" BOOLEAN NOT NULL DEFAULT false,
    "restoredFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanySettingsVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanySettingsVersion_companyId_kind_createdAt_idx" ON "CompanySettingsVersion"("companyId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanySettingsVersion" ADD CONSTRAINT "CompanySettingsVersion_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing companies start with one version of each, so their first edit can be restored.
INSERT INTO "CompanySettingsVersion" ("id", "companyId", "kind", "config")
SELECT gen_random_uuid()::text, "id", 'config', "config" FROM "Company";

INSERT INTO "CompanySettingsVersion" ("id", "companyId", "kind", "instructions")
SELECT gen_random_uuid()::text, "id", 'instructions', "instructions" FROM "Company";
