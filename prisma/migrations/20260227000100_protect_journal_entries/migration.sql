-- SOC 2 CC6.1: Immutability trigger for journal_entries
-- Allows updates ONLY to status and reversed_by_entry_id (needed for reversals).
-- Blocks modification of all accounting-critical fields after posting.
-- Blocks DELETE entirely — use reversals instead.

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER 1: Protect immutable fields on UPDATE
-- ═══════════════════════════════════════════════════════════════════
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_journal_entry_fields
BEFORE UPDATE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_journal_entry_mutation();

-- ═══════════════════════════════════════════════════════════════════
-- TRIGGER 2: Block DELETE entirely
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_journal_entry_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Journal entries cannot be deleted. Use reversals.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_journal_entry_deletes
BEFORE DELETE ON journal_entries
FOR EACH ROW
EXECUTE FUNCTION prevent_journal_entry_delete();
