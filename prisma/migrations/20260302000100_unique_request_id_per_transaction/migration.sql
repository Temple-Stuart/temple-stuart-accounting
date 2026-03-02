-- ═══════════════════════════════════════════════════════════════════
-- SOC 2 IDEMP control: Unique request_id per journal entry
-- Ensures no two JEs share the same request_id.
-- Partial index (WHERE request_id IS NOT NULL) allows NULLs.
--
-- PREREQUISITE: Run the UPDATE query below BEFORE deploying this
-- migration. Existing batch request_ids are shared across
-- multiple JEs and must be made unique first.
--
-- UPDATE journal_entries
-- SET request_id = request_id || '-' || source_id
-- WHERE request_id IN (
--   SELECT request_id FROM journal_entries
--   WHERE request_id IS NOT NULL
--   GROUP BY request_id
--   HAVING COUNT(*) > 1
-- )
-- AND source_id IS NOT NULL;
-- ═══════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX idx_je_request_id_unique
ON journal_entries (request_id)
WHERE request_id IS NOT NULL;
