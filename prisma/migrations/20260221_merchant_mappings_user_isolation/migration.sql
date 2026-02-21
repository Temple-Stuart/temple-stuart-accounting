-- Add userId column to merchant_coa_mappings for data isolation
-- Step 1: Add column as nullable
ALTER TABLE merchant_coa_mappings
  ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- Step 2: Backfill all existing rows to Alex (the only user with financial data)
UPDATE merchant_coa_mappings
SET "userId" = 'cmfi3rcrl0000zcj0ajbj4za5'
WHERE "userId" IS NULL;

-- Step 3: Make column NOT NULL
ALTER TABLE merchant_coa_mappings
  ALTER COLUMN "userId" SET NOT NULL;

-- Step 4: Add foreign key constraint
ALTER TABLE merchant_coa_mappings
  ADD CONSTRAINT merchant_coa_mappings_userId_fkey
  FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Drop old unique constraint and create new one scoped to userId
ALTER TABLE merchant_coa_mappings
  DROP CONSTRAINT IF EXISTS merchant_coa_mappings_merchant_name_plaid_category_primary_key;

ALTER TABLE merchant_coa_mappings
  ADD CONSTRAINT merchant_coa_mappings_userId_merchant_name_plaid_category_pr_key
  UNIQUE ("userId", merchant_name, plaid_category_primary);

-- Step 6: Add userId index for fast lookups
CREATE INDEX IF NOT EXISTS idx_merchant_user ON merchant_coa_mappings("userId");
