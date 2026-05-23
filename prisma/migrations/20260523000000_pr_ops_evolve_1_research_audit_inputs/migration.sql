-- PR-Ops-Evolve-1: evolve-loop foundation.
-- Adds the 'superseded' task status (the evolve loop's "retired because reality
-- moved past it" state) and two nullable paste-input columns on operations_projects
-- (deep research output + Claude Code audit findings) that feed reality into
-- task generation.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a BEGIN/COMMIT block. This
-- file intentionally uses bare statements (no explicit transaction), so each runs
-- in autocommit — matching the existing enum-ADD-VALUE migration precedent
-- (20260518500002). The new value is NOT referenced by any statement in this file,
-- so there is no "use new enum value in the same transaction" hazard. Additive
-- only (new enum value + nullable columns) — safe on `prisma migrate deploy`, no
-- backfill.

ALTER TYPE "OperationsTaskStatus" ADD VALUE IF NOT EXISTS 'superseded';

ALTER TABLE "operations_projects" ADD COLUMN "deep_research_input" TEXT;
ALTER TABLE "operations_projects" ADD COLUMN "claude_code_audit_input" TEXT;
