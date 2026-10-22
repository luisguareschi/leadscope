-- The config had one `displayName`, labeled "Nombre del asistente" in the panel but used by the
-- prompt as the company's name. It splits in two: `config.assistantName` (the assistant's own
-- name, may be empty) and `Company.name` (the company's, edited in Configuración and versioned).
-- A display name that only repeated the company's name becomes an empty assistant name. Same
-- mapping as `upgradeLegacyConfig` in src/companies/company-config.ts.

-- AlterEnum
ALTER TYPE "SettingsKind" ADD VALUE 'companyName';

-- AlterTable
ALTER TABLE "CompanySettingsVersion" ADD COLUMN "companyName" TEXT;

CREATE FUNCTION "leadscope_split_names"(config JSONB, company_name TEXT) RETURNS JSONB AS $$
DECLARE
  upgraded JSONB := config;
  display TEXT;
BEGIN
  IF upgraded IS NULL OR jsonb_typeof(upgraded) <> 'object' OR NOT upgraded ? 'displayName' THEN
    RETURN upgraded;
  END IF;
  IF NOT upgraded ? 'assistantName' THEN
    display := CASE
      WHEN jsonb_typeof(upgraded->'displayName') = 'string' THEN btrim(upgraded->>'displayName')
      ELSE ''
    END;
    upgraded := upgraded || jsonb_build_object('assistantName', CASE
      WHEN lower(display) = lower(btrim(company_name)) THEN ''
      ELSE display
    END);
  END IF;
  RETURN upgraded - 'displayName';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "Company" SET "config" = "leadscope_split_names"("config", "name");

UPDATE "CompanySettingsVersion" AS "version"
SET "config" = "leadscope_split_names"("version"."config", "company"."name")
FROM "Company" AS "company"
WHERE "version"."companyId" = "company"."id"
  AND "version"."kind" = 'config'
  AND "version"."config" IS NOT NULL;

DROP FUNCTION "leadscope_split_names"(JSONB, TEXT);

-- Every company starts with one version of its name, so its first rename can be restored.
INSERT INTO "CompanySettingsVersion" ("id", "companyId", "kind", "companyName")
SELECT gen_random_uuid()::text, "id", 'companyName', "name" FROM "Company";
