-- Operators can set a thread's stage by hand, in any direction. The thread keeps the last change
-- (by a person, or by the assistant with no email), and every change a person makes is logged.
-- Existing threads have no recorded change.

ALTER TABLE "Thread"
  ADD COLUMN "stageChangedAt" TIMESTAMP(3),
  ADD COLUMN "stageChangedById" TEXT,
  ADD COLUMN "stageChangedByEmail" TEXT;

CREATE INDEX "Thread_stageChangedById_idx" ON "Thread"("stageChangedById");

ALTER TABLE "Thread" ADD CONSTRAINT "Thread_stageChangedById_fkey" FOREIGN KEY ("stageChangedById") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LeadStageChange" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "fromStage" "LeadStage" NOT NULL,
    "toStage" "LeadStage" NOT NULL,
    "changedById" TEXT,
    "changedByEmail" TEXT NOT NULL,
    "support" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStageChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadStageChange_threadId_createdAt_idx" ON "LeadStageChange"("threadId", "createdAt");
CREATE INDEX "LeadStageChange_companyId_idx" ON "LeadStageChange"("companyId");
CREATE INDEX "LeadStageChange_changedById_idx" ON "LeadStageChange"("changedById");

ALTER TABLE "LeadStageChange" ADD CONSTRAINT "LeadStageChange_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadStageChange" ADD CONSTRAINT "LeadStageChange_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadStageChange" ADD CONSTRAINT "LeadStageChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
