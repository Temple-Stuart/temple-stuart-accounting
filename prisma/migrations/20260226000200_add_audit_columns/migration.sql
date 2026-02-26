-- Phase 1A.2: Add created_at and created_by audit columns to all tables
-- SOC 2 requires these on every table. Must be present before first committed transaction.

-- entities: already has created_at, add created_by
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- chart_of_accounts: already has created_at, add created_by
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- journal_entries: already has created_at, add created_by
ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- ledger_entries: already has created_at, add created_by
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- account_tax_mappings: missing both created_at and created_by
ALTER TABLE "account_tax_mappings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "account_tax_mappings" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- merchant_coa_mappings: already has both created_at and created_by — no changes needed
