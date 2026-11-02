-- Operators organize knowledge files into folders, nested to any depth. Existing files stay at the
-- root (folderId null). A name is unique within one folder, so the same name may live in two
-- folders; at the root a partial index keeps it unique per company, as before.

DROP INDEX "KnowledgeFile_companyId_nameKey_key";

ALTER TABLE "KnowledgeFile" ADD COLUMN "folderId" TEXT;

CREATE TABLE "KnowledgeFolder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "KnowledgeFolder_companyId_idx" ON "KnowledgeFolder"("companyId");

CREATE UNIQUE INDEX "KnowledgeFolder_parentId_nameKey_key" ON "KnowledgeFolder"("parentId", "nameKey");

CREATE UNIQUE INDEX "KnowledgeFolder_root_nameKey_key" ON "KnowledgeFolder"("companyId", "nameKey") WHERE ("parentId" IS NULL);

CREATE INDEX "KnowledgeFile_companyId_idx" ON "KnowledgeFile"("companyId");

CREATE UNIQUE INDEX "KnowledgeFile_folderId_nameKey_key" ON "KnowledgeFile"("folderId", "nameKey");

CREATE UNIQUE INDEX "KnowledgeFile_root_nameKey_key" ON "KnowledgeFile"("companyId", "nameKey") WHERE ("folderId" IS NULL);

ALTER TABLE "KnowledgeFolder" ADD CONSTRAINT "KnowledgeFolder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeFolder" ADD CONSTRAINT "KnowledgeFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "KnowledgeFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeFile" ADD CONSTRAINT "KnowledgeFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "KnowledgeFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
