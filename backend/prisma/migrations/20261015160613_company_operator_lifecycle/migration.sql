-- Audit entries outlive the company they belong to.
ALTER TABLE "AdminAuditEntry" DROP CONSTRAINT "AdminAuditEntry_companyId_fkey";

ALTER TABLE "AdminAuditEntry" ADD COLUMN "companySlug" TEXT,
ALTER COLUMN "companyId" DROP NOT NULL;

UPDATE "AdminAuditEntry" AS entry
SET "companySlug" = company."slug"
FROM "Company" AS company
WHERE company."id" = entry."companyId";

ALTER TABLE "AdminAuditEntry" ALTER COLUMN "companySlug" SET NOT NULL;

ALTER TABLE "AdminAuditEntry" ADD CONSTRAINT "AdminAuditEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Archiving a company or an operator is reversible.
ALTER TABLE "Company" ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Operator" ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "inviteError" TEXT,
ADD COLUMN "invitedAt" TIMESTAMP(3);
