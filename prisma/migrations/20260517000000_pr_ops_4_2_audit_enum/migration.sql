-- PR-Ops-4.2: add operations_project_task_uncompleted to AuditActionType enum
-- Note: PostgreSQL ALTER TYPE ADD VALUE cannot run inside a transaction block,
--       so this migration intentionally has no BEGIN/COMMIT.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_project_task_uncompleted';
