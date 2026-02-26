-- Phase 1A.4: Add bookkeeping_initialized flag to users
-- Allows onboarding check to be skipped for non-bookkeeping routes (scanner, AI, trading).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bookkeeping_initialized" BOOLEAN NOT NULL DEFAULT false;
