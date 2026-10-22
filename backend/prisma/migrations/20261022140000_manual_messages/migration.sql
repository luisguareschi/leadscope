-- Operators can write to the lead from the thread view, through the company's WhatsApp number.
-- A message keeps who wrote it, and why WhatsApp refused it when it did. Existing messages were
-- all written by the assistant (or are templates and inbound), so they keep no sender.

ALTER TABLE "Message"
  ADD COLUMN "error" TEXT,
  ADD COLUMN "sentByEmail" TEXT,
  ADD COLUMN "sentById" TEXT,
  ADD COLUMN "sentBySupport" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Message_sentById_idx" ON "Message"("sentById");

ALTER TABLE "Message" ADD CONSTRAINT "Message_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;
