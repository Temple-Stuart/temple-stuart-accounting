-- =============================================================================
-- PR-K: Embedding runs + enum extensions — DOWN MIGRATION
-- =============================================================================
-- Two reversal parts:
--   1. Drop embedding_runs table (data loss — operator must export first)
--   2. Recreate AuditActionType enum without the three new values
--      (Postgres has no DROP VALUE; full enum recreation required)
--
-- Safety: aborts if any audit_log rows reference the values being removed.
-- Standard practice is forward-fix migrations rather than running this.
-- =============================================================================

-- PART 1: Verify no audit_log references to enum values being removed
DO $$
DECLARE
  ref_count integer;
BEGIN
  SELECT COUNT(*) INTO ref_count
  FROM audit_log
  WHERE action_type IN (
    'regulatory_chunks_embedded',
    'embedding_run_completed',
    'embedding_run_cost_capped'
  );

  IF ref_count > 0 THEN
    RAISE EXCEPTION
      'Cannot remove enum values: % audit_log rows reference them. '
      'Archive those rows by explicit operator action before re-running.',
      ref_count;
  END IF;
END $$;

-- PART 2: Drop embedding_runs table
BEGIN;

DROP TABLE IF EXISTS embedding_runs;

COMMIT;

-- PART 3: Recreate AuditActionType enum without the new values
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
  'regulatory_document_ingested',
  'regulatory_document_superseded',
  'regulatory_ingest_run_completed',
  'user_login', 'user_logout',
  'permission_granted', 'permission_revoked',
  'data_export_initiated', 'data_export_completed',
  'system_other'
);

ALTER TABLE audit_log
  ALTER COLUMN action_type TYPE "AuditActionType"
  USING action_type::text::"AuditActionType";

DROP TYPE "AuditActionType_old";
