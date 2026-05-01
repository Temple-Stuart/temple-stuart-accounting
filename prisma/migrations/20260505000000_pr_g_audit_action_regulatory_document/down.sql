-- =============================================================================
-- PR-G: AuditActionType enum extension — DOWN MIGRATION
-- =============================================================================
-- Postgres does not support ALTER TYPE ... DROP VALUE directly; the
-- documented removal path requires recreating the enum without the values.
--
-- Safety: this down script aborts if any audit_log rows reference the
-- values being removed. Audit logs are immutable per SOC 2 control;
-- destroying them on a rollback would be worse than leaving the enum
-- values in place. If you genuinely need to remove these values, you
-- must first archive and remove the referencing audit_log rows by
-- explicit operator action, with documented justification.
--
-- This down script is for emergency rollback only. Standard practice
-- is to ship a forward-fix migration rather than apply this.
-- =============================================================================

DO $$
DECLARE
  ref_count integer;
BEGIN
  SELECT COUNT(*) INTO ref_count
  FROM audit_log
  WHERE action_type IN (
    'regulatory_document_ingested',
    'regulatory_document_superseded',
    'regulatory_ingest_run_completed'
  );

  IF ref_count > 0 THEN
    RAISE EXCEPTION
      'Cannot remove enum values: % audit_log rows reference them. '
      'Archive those rows by explicit operator action before re-running.',
      ref_count;
  END IF;
END $$;

-- Recreate enum without the new values.
-- Pattern: rename old enum, create new enum, alter columns, drop old enum.
ALTER TYPE "AuditActionType" RENAME TO "AuditActionType_old";

CREATE TYPE "AuditActionType" AS ENUM (
  'citation_created', 'citation_updated', 'citation_verified',
  'citation_status_changed', 'citation_superseded', 'citation_deleted',
  'task_created', 'task_updated', 'task_status_changed',
  'task_assigned', 'task_completed', 'task_evidence_attached',
  'task_attested', 'task_deleted',
  'mission_created', 'mission_updated', 'mission_status_changed', 'mission_deleted',
  'project_created', 'project_updated', 'project_deleted',
  'workstream_created', 'workstream_updated', 'workstream_deleted',
  'ai_generation_started', 'ai_generation_completed', 'ai_generation_failed',
  'ai_verification_passed', 'ai_verification_failed',
  'regulatory_source_added', 'regulatory_source_updated', 'regulatory_source_deactivated',
  'user_login', 'user_logout',
  'permission_granted', 'permission_revoked',
  'data_export_initiated', 'data_export_completed',
  'system_other'
);

ALTER TABLE audit_log
  ALTER COLUMN action_type TYPE "AuditActionType"
  USING action_type::text::"AuditActionType";

DROP TYPE "AuditActionType_old";
