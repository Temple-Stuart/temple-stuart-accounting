-- Phase 1A.3: Add request_id to journal_entries
-- Correlates multi-line journal entries to a single API request for SOC 2 audit trail.

ALTER TABLE "journal_entries" ADD COLUMN IF NOT EXISTS "request_id" TEXT;
