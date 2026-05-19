-- PR-Ops-4.9.1c: add audit action types for content scene CRUD
-- Note: ALTER TYPE ADD VALUE cannot run in BEGIN/COMMIT block.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_content_scene_created';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_content_scene_updated';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_content_scene_deleted';
