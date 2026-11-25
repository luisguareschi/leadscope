-- Configurable pipeline stages (including disqualified and no_response), automatic follow-up
-- tracking, public vs internal knowledge files backed by Supabase Storage, and message media.

CREATE TYPE "KnowledgeVisibility" AS ENUM ('internal', 'public');

ALTER TABLE "KnowledgeFile"
  ADD COLUMN "visibility" "KnowledgeVisibility" NOT NULL DEFAULT 'internal',
  ADD COLUMN "storagePath" TEXT,
  ADD COLUMN "description" TEXT;

ALTER TABLE "Thread"
  ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE TEXT USING "stage"::text,
  ALTER COLUMN "stage" SET DEFAULT 'qualifying',
  ADD COLUMN "followUpCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastFollowUpAt" TIMESTAMP(3);

ALTER TABLE "LeadStageChange"
  ALTER COLUMN "fromStage" TYPE TEXT USING "fromStage"::text,
  ALTER COLUMN "toStage" TYPE TEXT USING "toStage"::text;

DROP TYPE "LeadStage";

ALTER TABLE "Message"
  ADD COLUMN "mediaPath" TEXT,
  ADD COLUMN "mediaMimeType" TEXT,
  ADD COLUMN "mediaFileName" TEXT;
