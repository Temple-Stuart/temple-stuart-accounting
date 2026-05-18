-- PR-Ops-4.8.6b: add audit action types for routine step CRUD
-- Note: ALTER TYPE ADD VALUE cannot run in BEGIN/COMMIT block.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_step_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_step_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_step_deleted';
