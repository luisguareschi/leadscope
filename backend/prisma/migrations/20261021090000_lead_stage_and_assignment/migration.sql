-- A thread's status splits in two: the lead stage (forward-only, for the sales team) and the bot's
-- activity (paused / needsHuman, unchanged). Advisors take, assign, and mark threads contacted.

CREATE TYPE "LeadStage" AS ENUM ('qualifying', 'to_contact', 'contacted', 'not_interested');

ALTER TABLE "Thread"
  ADD COLUMN "stage" "LeadStage" NOT NULL DEFAULT 'qualifying',
  ADD COLUMN "handedOffAt" TIMESTAMP(3),
  ADD COLUMN "assignedToId" TEXT,
  ADD COLUMN "assignedAt" TIMESTAMP(3),
  ADD COLUMN "contactedAt" TIMESTAMP(3),
  ADD COLUMN "contactedById" TEXT,
  ADD COLUMN "contactedByEmail" TEXT;

CREATE INDEX "Thread_companyId_stage_handedOffAt_idx" ON "Thread"("companyId", "stage", "handedOffAt");
CREATE INDEX "Thread_assignedToId_idx" ON "Thread"("assignedToId");
CREATE INDEX "Thread_contactedById_idx" ON "Thread"("contactedById");

ALTER TABLE "Thread" ADD CONSTRAINT "Thread_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_contactedById_fkey" FOREIGN KEY ("contactedById") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing threads. Por contactar: every thread in handoff (asking for a call time, or handed off),
-- and a handed-off thread the lead reopened by writing again (answer, with a call time and every
-- required item of its company's config). The handoff time is the best stored guess: the last CRM
-- write, else the lead's last message. Closed threads are Sin interés. The rest stay Calificando.
UPDATE "Thread" AS t
SET "stage" = 'to_contact',
    "handedOffAt" = COALESCE(t."crmSyncedAt", t."lastInboundAt", t."lastMessageAt", t."createdAt")
FROM "Company" AS c
WHERE c."id" = t."companyId"
  AND (
    t."state" = 'handoff'
    OR (
      t."state" = 'answer'
      AND NULLIF(btrim(t."callTime"), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(c."config"->'collect') = 'array' THEN c."config"->'collect' ELSE '[]'::jsonb END
        ) AS item
        WHERE item->>'required' = 'true'
          AND NULLIF(btrim(COALESCE(t."collected"->>(item->>'key'), '')), '') IS NULL
      )
    )
  );

UPDATE "Thread" SET "stage" = 'not_interested' WHERE "state" = 'closed';
