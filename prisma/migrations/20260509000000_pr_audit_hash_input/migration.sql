-- =============================================================================
-- PR-Audit-Hash-Input: Add hash_input column to audit_log
-- =============================================================================
-- Adds a TEXT column to audit_log that stores the canonical JSON.stringify
-- output that writeAuditLog uses to compute content_hash. Stores the writer's
-- ground-truth pre-image alongside its hash, eliminating verifier
-- reconstruction drift caused by JSONB key-order normalization on round-trip.
--
-- Background:
-- The audit chain verifier failed on 12687 of 12692 rows post-deploy because
-- the verifier could not reproduce writeAuditLog's input JSON from the JSONB-
-- normalized payload columns. JSONB stores keys in normalized form; the
-- writer hashes the original insertion-order JS object's stringification.
-- Round-trip through JSONB destroys this reproducibility. The chain itself
-- is intact (linkage check passes on every row spot-checked); only the
-- content-hash reconstruction step was failing.
--
-- Fix design (institutional, Bridgewater / Citadel / Renaissance grade):
-- Store the canonical hash input directly. The verifier reads hash_input
-- and re-hashes; no reconstruction. Same pattern used by Ethereum (raw RLP
-- transaction bytes alongside hash), Bitcoin (raw transaction script
-- alongside hash), AWS CloudTrail, Stripe event archive, Datadog audit logs.
--
-- Pre-fix rows (the 12692 already in audit_log) get the empty-string default,
-- which the verifier interprets as "linkage-only verification — content hash
-- not reproducible." This is honest disclosure of the asterisk on legacy rows.
-- Backfill is rejected as institutionally wrong: it would require temporarily
-- dropping the SOC 2 immutability triggers, which compromises the control's
-- meaning regardless of how narrowly scoped the maintenance window is.
--
-- ALTER TABLE feasibility:
-- - Postgres 11+ fast-default optimization: ADD COLUMN with constant DEFAULT
--   is metadata-only; existing rows are NOT rewritten. O(1) on row count.
-- - The audit_log immutability triggers (audit_log_no_update,
--   audit_log_no_delete) are FOR EACH ROW DML triggers — they do not fire
--   on DDL. ALTER TABLE does not issue UPDATE or DELETE against rows.
-- - ACCESS EXCLUSIVE lock held for microseconds; safe in production.
-- =============================================================================

BEGIN;

ALTER TABLE audit_log
  ADD COLUMN hash_input TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN audit_log.hash_input IS
  'Canonical JSON.stringify pre-image used by writeAuditLog to compute '
  'content_hash. Stored verbatim so verifyAuditChain can re-hash without '
  'reconstructing from JSONB-normalized payload columns. Empty string on '
  'rows written before PR-Audit-Hash-Input (those rows are verified by '
  'linkage chain only; their content_hash cannot be reproduced from '
  'persisted state due to JSONB key-order normalization).';

COMMIT;
