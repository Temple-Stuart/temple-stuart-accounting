-- LAW-02 (2026-09-27) — A POSTING'S DOCUMENT ARRIVES ONCE, AND THEN IT IS FROZEN.
--
-- THE GAP. POST-01 (20260926180000_post_01_posting_document) added
-- journal_entries.document_reservation_id and document_money_event_id and left
-- them OUT of the immutability trigger (20260227000100_protect_journal_entries),
-- so scripts/post-01-retro-documents.ts could give a document to an entry posted
-- before the columns existed. That left them UPDATE-able forever: a posted entry's
-- booking could be swapped for another, or taken away, after the fact.
--
-- THE RULE (SOC 2 CC6.1, the same trigger's posture): a document may be SET ONCE —
-- NULL → a value is still allowed (the retro, or a document that arrives later);
-- once non-null it cannot change to another value and cannot go back to NULL.
-- Every field the trigger already froze stays frozen; status and
-- reversed_by_entry_id stay the only freely-updatable fields.
--
-- CREATE OR REPLACE on the SAME function — the existing trigger
-- protect_journal_entry_fields (BEFORE UPDATE ... EXECUTE FUNCTION
-- prevent_journal_entry_mutation()) picks the new body up; no trigger is dropped
-- or recreated. Nothing is backfilled; no row is touched.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; Alex runs this
-- via psql, or it applies at deploy after merge.

CREATE OR REPLACE FUNCTION prevent_journal_entry_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow updates ONLY to status and reversed_by_entry_id (needed for reversals)
  -- Block changes to all other fields
  IF NEW.description IS DISTINCT FROM OLD.description
     OR NEW.date IS DISTINCT FROM OLD.date
     OR NEW.source_id IS DISTINCT FROM OLD.source_id
     OR NEW.source_type IS DISTINCT FROM OLD.source_type
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.request_id IS DISTINCT FROM OLD.request_id
     OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
     OR NEW."userId" IS DISTINCT FROM OLD."userId"
     OR NEW.is_reversal IS DISTINCT FROM OLD.is_reversal
     OR NEW.reverses_entry_id IS DISTINCT FROM OLD.reverses_entry_id
     OR NEW.metadata IS DISTINCT FROM OLD.metadata
  THEN
    RAISE EXCEPTION 'Journal entry immutable fields cannot be modified after posting. Only status and reversed_by_entry_id may be updated.';
  END IF;
  -- LAW-02: a document is set once. NULL → value passes; value → other value, or
  -- value → NULL, is refused by name.
  IF (OLD.document_reservation_id IS NOT NULL AND NEW.document_reservation_id IS DISTINCT FROM OLD.document_reservation_id)
     OR (OLD.document_money_event_id IS NOT NULL AND NEW.document_money_event_id IS DISTINCT FROM OLD.document_money_event_id)
  THEN
    RAISE EXCEPTION 'Journal entry document cannot change once set (document_reservation_id / document_money_event_id): a document arrives once — NULL may be set, a set document may not be replaced or removed.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
