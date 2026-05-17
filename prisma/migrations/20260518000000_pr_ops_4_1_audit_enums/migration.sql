-- PR-Ops-4.1: add daily plan + calendar block audit action types
-- Note: PostgreSQL ALTER TYPE ADD VALUE cannot run inside a transaction block.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_daily_plan_item_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_daily_plan_item_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_daily_plan_item_deleted';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_calendar_block_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_calendar_block_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_calendar_block_deleted';
