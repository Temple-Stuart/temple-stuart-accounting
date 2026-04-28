-- =================================================================
-- PR-C: Hash-chained audit log with SOC 2 immutability
-- =================================================================

-- STEP 1: Create enums
CREATE TYPE "AuditActorType" AS ENUM ('human_user', 'ai_agent', 'system_automation', 'external_integration');

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

-- STEP 2: Create audit_log table
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sequence_number" BIGSERIAL NOT NULL,
    "prev_hash" VARCHAR(64) NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "actor_user_id" VARCHAR(255),
    "actor_email" VARCHAR(255),
    "actor_type" "AuditActorType" NOT NULL,
    "actor_session_id" VARCHAR(255),
    "actor_ip" VARCHAR(45),
    "action_type" "AuditActionType" NOT NULL,
    "action_description" TEXT NOT NULL,
    "target_table" VARCHAR(100) NOT NULL,
    "target_id" VARCHAR(255),
    "payload_before" JSONB,
    "payload_after" JSONB,
    "payload_metadata" JSONB,
    "request_id" VARCHAR(255),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_log_sequence_number_key" ON "audit_log"("sequence_number");
CREATE UNIQUE INDEX "audit_log_content_hash_key" ON "audit_log"("content_hash");
CREATE INDEX "audit_log_sequence_number_idx" ON "audit_log"("sequence_number");
CREATE INDEX "audit_log_actor_user_id_created_at_idx" ON "audit_log"("actor_user_id", "created_at");
CREATE INDEX "audit_log_action_type_created_at_idx" ON "audit_log"("action_type", "created_at");
CREATE INDEX "audit_log_target_table_target_id_idx" ON "audit_log"("target_table", "target_id");
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- STEP 3: (sequence handled by BIGSERIAL)

-- STEP 4: SOC 2 immutability triggers
-- Pattern mirrors prisma/migrations/20260227000100_protect_journal_entries/migration.sql
-- audit_log is APPEND-ONLY: INSERTs allowed, UPDATEs and DELETEs blocked.

CREATE OR REPLACE FUNCTION prevent_audit_log_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. UPDATE not permitted on row %', OLD.id
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_audit_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. DELETE not permitted on row %', OLD.id
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_update();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_delete();

-- STEP 5: Hash-chain integrity CHECK constraint
-- prev_hash must be 'GENESIS' (genesis row) or a 64-char SHA-256 hex string.
ALTER TABLE "audit_log" ADD CONSTRAINT audit_log_genesis_or_chained
  CHECK (
    prev_hash = 'GENESIS' OR
    LENGTH(prev_hash) = 64
  );

-- STEP 6: Genesis row — chain anchor
-- content_hash is SHA-256 of the literal string 'TEMPLE_STUART_AUDIT_LOG_GENESIS_v1'
INSERT INTO "audit_log" (
  id,
  prev_hash,
  content_hash,
  actor_user_id,
  actor_email,
  actor_type,
  action_type,
  action_description,
  target_table,
  target_id,
  payload_metadata,
  created_at
) VALUES (
  gen_random_uuid(),
  'GENESIS',
  encode(sha256('TEMPLE_STUART_AUDIT_LOG_GENESIS_v1'::bytea), 'hex'),
  NULL,
  NULL,
  'system_automation',
  'system_other',
  'Audit log chain genesis. PR-C deployment.',
  'audit_log',
  NULL,
  jsonb_build_object('version', 'v1', 'pr', 'PR-C', 'deployed_at', now()),
  now()
);
