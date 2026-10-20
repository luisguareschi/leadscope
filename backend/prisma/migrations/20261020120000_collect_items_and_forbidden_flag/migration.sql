-- The three fixed qualifying questions become a configurable list of items to find out
-- (`config.collect`), and forbidden topics lose their regex patterns: the model flags a topic in
-- submit_turn and the engine sends the fixed line. Same mapping as `upgradeLegacyConfig` in
-- src/companies/company-config.ts, so stored rows and versions match what the app reads.

CREATE FUNCTION "leadscope_upgrade_config"(config JSONB) RETURNS JSONB AS $$
DECLARE
  upgraded JSONB := config;
BEGIN
  IF upgraded IS NULL OR jsonb_typeof(upgraded) <> 'object' THEN
    RETURN upgraded;
  END IF;
  IF upgraded ? 'questions' AND NOT upgraded ? 'collect' THEN
    upgraded := upgraded || jsonb_build_object('collect', jsonb_build_array(
      jsonb_build_object(
        'key', 'interest',
        'name', 'Interés',
        'description', COALESCE(upgraded->'questions'->>'interest', ''),
        'required', true),
      jsonb_build_object(
        'key', 'budget',
        'name', 'Presupuesto',
        'description', COALESCE(upgraded->'questions'->>'budget', ''),
        'required', true),
      jsonb_build_object(
        'key', 'knowsProjects',
        'name', 'Conoce los proyectos',
        'description', COALESCE(upgraded->'questions'->>'knowsProjects', ''),
        'required', true)
    ));
  END IF;
  upgraded := upgraded - 'questions';
  IF jsonb_typeof(upgraded->'forbiddenTopics') = 'object' THEN
    upgraded := jsonb_set(upgraded, '{forbiddenTopics}', (upgraded->'forbiddenTopics') - 'patterns');
  END IF;
  RETURN upgraded;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "Company" SET "config" = "leadscope_upgrade_config"("config");

UPDATE "CompanySettingsVersion"
SET "config" = "leadscope_upgrade_config"("config")
WHERE "kind" = 'config' AND "config" IS NOT NULL;

DROP FUNCTION "leadscope_upgrade_config"(JSONB);

-- Threads keep what they knew under the same keys. knowsProjects was a boolean; it is text now.
ALTER TABLE "Thread"
  ADD COLUMN "collected" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN "summary" TEXT;

UPDATE "Thread"
SET "collected" = jsonb_strip_nulls(jsonb_build_object(
  'interest', NULLIF(btrim("interest"), ''),
  'budget', NULLIF(btrim("budget"), ''),
  'knowsProjects', CASE
    WHEN "knowsProjects" IS TRUE THEN 'Sí'
    WHEN "knowsProjects" IS FALSE THEN 'No'
  END
));

ALTER TABLE "Thread"
  DROP COLUMN "interest",
  DROP COLUMN "budget",
  DROP COLUMN "knowsProjects";
