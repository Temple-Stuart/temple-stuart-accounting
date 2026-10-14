-- TASKS-ONE-02 (2026-10-14) — ONE DONE: the day card's done is the routine's done.
--
-- The routine's completion now mirrors the day card's stop records
-- (src/lib/operations/routineDone.ts): the stops routes create it when a write
-- makes the occurrence done (audited operations_routine_completed, the value the
-- deleted completions POST wrote), and — new here — delete it when a write leaves
-- the occurrence not done, and move it when a still-done occurrence's done_at
-- changes (src/lib/operations/routineCompletion.ts). Those two moves get their own
-- audit types, appended in ALTER TYPE order; both are in the audit-log route's
-- operations_ list.
--
-- Neither value is used in this migration (a value ADDed in a transaction cannot
-- be used in it). AUTHORED here, applied at deploy (package.json runs prisma
-- migrate deploy before next build). NO BACKFILL, no row written: records saved
-- before this PR do not create completions; the next write to an occurrence's
-- records brings that occurrence's completion in step.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_uncompleted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_completion_updated';
