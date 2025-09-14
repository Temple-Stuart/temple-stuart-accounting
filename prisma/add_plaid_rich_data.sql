-- Add all the rich Plaid data columns to transactions table
ALTER TABLE "transactions" 
ADD COLUMN IF NOT EXISTS "personal_finance_category" JSONB,
ADD COLUMN IF NOT EXISTS "personal_finance_category_icon_url" TEXT,
ADD COLUMN IF NOT EXISTS "counterparties" JSONB,
ADD COLUMN IF NOT EXISTS "logo_url" TEXT,
ADD COLUMN IF NOT EXISTS "website" TEXT,
ADD COLUMN IF NOT EXISTS "payment_channel" TEXT,
ADD COLUMN IF NOT EXISTS "location" JSONB,
ADD COLUMN IF NOT EXISTS "payment_meta" JSONB,
ADD COLUMN IF NOT EXISTS "iso_currency_code" TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS "authorized_date" DATE,
ADD COLUMN IF NOT EXISTS "transaction_type" TEXT,
ADD COLUMN IF NOT EXISTS "check_number" TEXT,
ADD COLUMN IF NOT EXISTS "datetime" TIMESTAMP;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_payment_channel" ON "transactions"("payment_channel");
CREATE INDEX IF NOT EXISTS "idx_personal_finance_primary" ON "transactions"((personal_finance_category->>'primary'));
CREATE INDEX IF NOT EXISTS "idx_personal_finance_detailed" ON "transactions"((personal_finance_category->>'detailed'));
