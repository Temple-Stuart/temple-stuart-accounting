-- Add missing columns to plaid_items if they don't exist
ALTER TABLE "plaid_items" 
ADD COLUMN IF NOT EXISTS "needs_update" BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMP(3);

-- Add RFP table if it doesn't exist
CREATE TABLE IF NOT EXISTS "rfps" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "company" TEXT,
  "tier" TEXT NOT NULL,
  "message" TEXT,
  "status" TEXT DEFAULT 'pending',
  "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);
