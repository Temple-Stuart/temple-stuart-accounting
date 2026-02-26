-- Phase 1A.1: Reconcile triggers after schema rebuild
-- The original foundation migration (20250930) created triggers referencing
-- "transaction_id" but the schema was rebuilt with "journal_entry_id".
-- This migration ensures all custom DB objects use correct column names.

-- ═══════════════════════════════════════════════════════════════════
-- FIX: prevent_ledger_modifications trigger
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION prevent_ledger_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries cannot be modified or deleted after posting';
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger (DROP IF EXISTS then CREATE)
DROP TRIGGER IF EXISTS no_ledger_updates ON ledger_entries;
CREATE TRIGGER no_ledger_updates
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modifications();

-- ═══════════════════════════════════════════════════════════════════
-- FIX: validate_transaction_balance trigger — use journal_entry_id
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION validate_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
  debit_sum BIGINT;
  credit_sum BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'D' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN entry_type = 'C' THEN amount ELSE 0 END), 0)
  INTO debit_sum, credit_sum
  FROM ledger_entries
  WHERE journal_entry_id = NEW.journal_entry_id;

  IF debit_sum != credit_sum THEN
    RAISE EXCEPTION 'Transaction must be balanced: debits=% credits=%', debit_sum, credit_sum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with correct column reference
DROP TRIGGER IF EXISTS check_transaction_balance ON ledger_entries;
CREATE TRIGGER check_transaction_balance
AFTER INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION validate_transaction_balance();

-- ═══════════════════════════════════════════════════════════════════
-- CHECK CONSTRAINTS — Ensure they exist on current schema
-- ═══════════════════════════════════════════════════════════════════
-- balance_type CHECK on chart_of_accounts
DO $$ BEGIN
  ALTER TABLE chart_of_accounts ADD CONSTRAINT chk_balance_type CHECK (balance_type IN ('D', 'C'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- entry_type CHECK on ledger_entries
DO $$ BEGIN
  ALTER TABLE ledger_entries ADD CONSTRAINT chk_entry_type CHECK (entry_type IN ('D', 'C'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- amount > 0 CHECK on ledger_entries
DO $$ BEGIN
  ALTER TABLE ledger_entries ADD CONSTRAINT chk_amount_positive CHECK (amount > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
