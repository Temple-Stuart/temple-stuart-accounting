-- Create chart of accounts table
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50) NOT NULL,
  balance_type CHAR(1) NOT NULL CHECK (balance_type IN ('D', 'C')),
  settled_balance BIGINT DEFAULT 0,
  pending_balance BIGINT DEFAULT 0,
  version INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT false,
  entity_type VARCHAR(10) CHECK (entity_type IN ('personal', 'business')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create journal transactions table
CREATE TABLE journal_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date TIMESTAMP NOT NULL,
  description TEXT,
  external_transaction_id VARCHAR(255),
  plaid_transaction_id VARCHAR(255),
  document_id UUID,
  posted_at TIMESTAMP,
  reversed_by_transaction_id UUID REFERENCES journal_transactions(id),
  created_by UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create ledger entries table
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES journal_transactions(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  entry_type CHAR(1) NOT NULL CHECK (entry_type IN ('D', 'C')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Prevent modifications to posted ledger entries
CREATE OR REPLACE FUNCTION prevent_ledger_modifications()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ledger entries cannot be modified or deleted after posting';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_ledger_updates
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_ledger_modifications();

-- Validate balanced transactions
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
  WHERE transaction_id = NEW.transaction_id;

  IF debit_sum != credit_sum THEN
    RAISE EXCEPTION 'Transaction must be balanced: debits=% credits=%', debit_sum, credit_sum;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_transaction_balance
AFTER INSERT ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION validate_transaction_balance();

-- Create indexes
CREATE INDEX idx_ledger_account_date ON ledger_entries(account_id, created_at);
CREATE INDEX idx_ledger_transaction ON ledger_entries(transaction_id);
CREATE INDEX idx_transactions_date ON journal_transactions(transaction_date);
CREATE INDEX idx_transactions_external ON journal_transactions(external_transaction_id);
CREATE INDEX idx_transactions_plaid ON journal_transactions(plaid_transaction_id);
CREATE INDEX idx_coa_code ON chart_of_accounts(code);
