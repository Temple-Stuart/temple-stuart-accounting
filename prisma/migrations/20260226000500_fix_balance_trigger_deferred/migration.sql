-- Fix: make balance validation trigger DEFERRABLE INITIALLY DEFERRED
-- so that both debit and credit ledger entries can be inserted within
-- a transaction before the balance check fires.
--
-- Previously the trigger fired AFTER each row INSERT, meaning the first
-- ledger entry (debit) was validated before the second (credit) existed,
-- causing "Transaction must be balanced: debits=X credits=0" errors.

-- Drop the existing non-deferred trigger
DROP TRIGGER IF EXISTS check_transaction_balance ON ledger_entries;

-- Recreate as a deferred constraint trigger
CREATE CONSTRAINT TRIGGER check_transaction_balance
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION validate_transaction_balance();
