-- PR-Ops-4.9.1d: add audit action types for content take CRUD
-- Note: ALTER TYPE ADD VALUE cannot run in BEGIN/COMMIT block.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_content_take_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_content_take_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_content_take_deleted';
