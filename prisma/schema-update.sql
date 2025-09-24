-- Add missing columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS authorized_date DATE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS authorized_datetime TIMESTAMP;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counterparties JSONB;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS location JSONB;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(50);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_meta JSONB;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS personal_finance_category JSONB;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS personal_finance_category_icon_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_code VARCHAR(50);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS website TEXT;

-- Create investment_transactions table
CREATE TABLE IF NOT EXISTS investment_transactions (
  id VARCHAR(255) PRIMARY KEY,
  investment_transaction_id VARCHAR(255) UNIQUE NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  amount DOUBLE PRECISION,
  cancel_transaction_id VARCHAR(255),
  date DATE NOT NULL,
  fees DOUBLE PRECISION,
  iso_currency_code VARCHAR(10),
  name TEXT,
  price DOUBLE PRECISION,
  quantity DOUBLE PRECISION,
  security_id VARCHAR(255),
  subtype VARCHAR(50),
  type VARCHAR(50),
  unofficial_currency_code VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
