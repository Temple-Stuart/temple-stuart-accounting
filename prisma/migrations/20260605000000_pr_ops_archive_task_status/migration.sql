-- PR-Ops-Archive: add the 'archived' task status (out-of-scope soft archive).
--
-- Mirrors the routines is_active soft-retire pattern for tasks/projects: an
-- archived task is hidden from all active queues but its history (status
-- history, past daily-plan items, completed calendar blocks, evolution/version
-- rows) is fully preserved. ProjectStatus already carries 'archived', so no
-- project-side enum change is needed.
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a BEGIN/COMMIT block. This
-- file intentionally uses a bare statement (no explicit transaction) so it runs
-- in autocommit — matching the existing enum-ADD-VALUE precedent
-- (20260523000000_pr_ops_evolve_1_research_audit_inputs, which adds 'superseded'
-- the same way). The new value is NOT referenced by any other statement in this
-- file, so there is no "use new enum value in the same transaction" hazard.
-- Additive only — safe on `prisma migrate deploy`, no backfill.
--
-- Already applied live against Azure Postgres; IF NOT EXISTS keeps deploy
-- idempotent so other environments converge cleanly.

ALTER TYPE "OperationsTaskStatus" ADD VALUE IF NOT EXISTS 'archived';
