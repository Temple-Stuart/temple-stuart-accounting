-- Add strategy and tradeNum columns to investment_transactions
ALTER TABLE "investment_transactions" ADD COLUMN IF NOT EXISTS "strategy" TEXT;
ALTER TABLE "investment_transactions" ADD COLUMN IF NOT EXISTS "tradeNum" TEXT;
