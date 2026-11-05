-- HubSpot becomes optional per company. Existing companies keep NULL here: the token is inside the
-- encrypted secrets, so the backend decides on start (on when a HubSpot token is set, off when not).
-- Companies created from now on are written with false.
ALTER TABLE "Company" ADD COLUMN "hubspotEnabled" BOOLEAN;
ALTER TABLE "Company" ADD COLUMN "hubspotPortalId" TEXT;
ALTER TABLE "Company" ADD COLUMN "hubspotUiDomain" TEXT;
