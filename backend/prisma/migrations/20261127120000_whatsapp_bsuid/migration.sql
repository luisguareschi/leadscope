-- Support WhatsApp Business-Scoped User IDs (BSUID) and usernames for leads who hide their phone
-- number. PostgreSQL UNIQUE indexes treat NULLs as distinct, so multiple BSUID-only threads
-- (phone IS NULL) or multiple phone-only threads (bsuid IS NULL) per company never collide.
ALTER TABLE "Thread"
  ALTER COLUMN "phone" DROP NOT NULL,
  ALTER COLUMN "waId" DROP NOT NULL,
  ADD COLUMN "bsuid" TEXT,
  ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "Thread_companyId_bsuid_key" ON "Thread"("companyId", "bsuid");
