-- One login can be an operator of several companies: email and Supabase user become unique per
-- company instead of globally. Indexes only; no row changes. NULL Supabase user ids stay distinct,
-- so unlinked invited rows never collide.
DROP INDEX "Operator_email_key";
DROP INDEX "Operator_supabaseUserId_key";

CREATE UNIQUE INDEX "Operator_companyId_email_key" ON "Operator"("companyId", "email");
CREATE UNIQUE INDEX "Operator_companyId_supabaseUserId_key" ON "Operator"("companyId", "supabaseUserId");
CREATE INDEX "Operator_email_idx" ON "Operator"("email");
CREATE INDEX "Operator_supabaseUserId_idx" ON "Operator"("supabaseUserId");
