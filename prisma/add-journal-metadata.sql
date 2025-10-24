-- Add metadata fields to journal_transactions table
ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS account_code VARCHAR(20);
ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS amount INTEGER;
ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS strategy VARCHAR(50);
ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS trade_num VARCHAR(20);
