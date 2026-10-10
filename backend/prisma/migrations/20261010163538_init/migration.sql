-- CreateEnum
CREATE TYPE "ThreadState" AS ENUM ('greeting', 'qualify', 'answer', 'handoff', 'closed');

-- CreateEnum
CREATE TYPE "ThreadSource" AS ENUM ('whatsapp', 'form');

-- CreateEnum
CREATE TYPE "CrmAction" AS ENUM ('handoff', 'close', 'needs_human');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('inbound', 'outbound');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "encryptedSecrets" TEXT,
    "whatsappPhoneNumberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Operator" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Operator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeFile" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "charCount" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thread" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "source" "ThreadSource" NOT NULL DEFAULT 'whatsapp',
    "state" "ThreadState" NOT NULL DEFAULT 'greeting',
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "pausedAt" TIMESTAMP(3),
    "needsHuman" BOOLEAN NOT NULL DEFAULT false,
    "needsHumanReason" TEXT,
    "interest" TEXT,
    "budget" TEXT,
    "knowsProjects" BOOLEAN,
    "callTime" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "processingUntil" TIMESTAMP(3),
    "crmContactId" TEXT,
    "crmPendingAction" "CrmAction",
    "crmAttempts" INTEGER NOT NULL DEFAULT 0,
    "crmNextAttemptAt" TIMESTAMP(3),
    "crmLastError" TEXT,
    "crmSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "waMessageId" TEXT,
    "status" TEXT,
    "handledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LlmUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "threadId" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LlmUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_whatsappPhoneNumberId_key" ON "Company"("whatsappPhoneNumberId");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_email_key" ON "Operator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Operator_supabaseUserId_key" ON "Operator"("supabaseUserId");

-- CreateIndex
CREATE INDEX "Operator_companyId_idx" ON "Operator"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeFile_companyId_nameKey_key" ON "KnowledgeFile"("companyId", "nameKey");

-- CreateIndex
CREATE INDEX "Thread_companyId_lastMessageAt_idx" ON "Thread"("companyId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Thread_crmPendingAction_idx" ON "Thread"("crmPendingAction");

-- CreateIndex
CREATE UNIQUE INDEX "Thread_companyId_phone_key" ON "Thread"("companyId", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "Message_waMessageId_key" ON "Message"("waMessageId");

-- CreateIndex
CREATE INDEX "Message_threadId_sentAt_idx" ON "Message"("threadId", "sentAt");

-- CreateIndex
CREATE INDEX "Message_companyId_idx" ON "Message"("companyId");

-- CreateIndex
CREATE INDEX "Message_direction_handledAt_idx" ON "Message"("direction", "handledAt");

-- CreateIndex
CREATE INDEX "LlmUsage_companyId_createdAt_idx" ON "LlmUsage"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "Operator" ADD CONSTRAINT "Operator_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFile" ADD CONSTRAINT "KnowledgeFile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeFile" ADD CONSTRAINT "KnowledgeFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "Operator"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thread" ADD CONSTRAINT "Thread_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmUsage" ADD CONSTRAINT "LlmUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LlmUsage" ADD CONSTRAINT "LlmUsage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "Thread"("id") ON DELETE SET NULL ON UPDATE CASCADE;
