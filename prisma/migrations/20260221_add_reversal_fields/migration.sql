-- Add reversal tracking fields to journal_transactions for CPA audit trail
-- Instead of deleting journal entries on uncommit, we now create reversing entries

ALTER TABLE journal_transactions
  ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverses_journal_id UUID,
  ADD COLUMN IF NOT EXISTS reversal_date TIMESTAMPTZ;
