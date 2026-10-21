-- HubSpot from the lead's first message: every lead gets a contact, updated after each bot turn
-- that changes what HubSpot shows. CRM writes get their own lease so they never hold up a reply,
-- and a request version so a write that finishes after a newer request leaves that one pending.

ALTER TYPE "CrmAction" ADD VALUE 'update';

ALTER TABLE "Thread"
  ADD COLUMN "crmRequestVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "crmLeaseUntil" TIMESTAMP(3);
