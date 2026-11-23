-- Company-wide switch to pause automated assistant replies (WhatsApp turns and form welcomes)
-- while keeping inbound capture, HubSpot sync, manual replies, and Probar asistente working.
ALTER TABLE "Company" ADD COLUMN "assistantPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Company" ADD COLUMN "assistantPausedAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN "assistantPausedByEmail" TEXT;
