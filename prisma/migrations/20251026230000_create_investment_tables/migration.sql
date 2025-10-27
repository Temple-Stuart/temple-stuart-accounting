-- Create securities table if not exists
CREATE TABLE IF NOT EXISTS "securities" (
  "id" TEXT PRIMARY KEY,
  "securityId" TEXT UNIQUE NOT NULL,
  "isin" TEXT,
  "cusip" TEXT,
  "sedol" TEXT,
  "ticker_symbol" TEXT,
  "name" TEXT,
  "type" TEXT,
  "close_price" DOUBLE PRECISION,
  "close_price_as_of" TIMESTAMP(3),
  "option_contract_type" TEXT,
  "option_strike_price" DOUBLE PRECISION,
  "option_expiration_date" TIMESTAMP(3),
  "option_underlying_ticker" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Create investment_transactions table if not exists
CREATE TABLE IF NOT EXISTS "investment_transactions" (
  "id" TEXT PRIMARY KEY,
  "investment_transaction_id" TEXT UNIQUE NOT NULL,
  "accountId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION,
  "cancel_transaction_id" TEXT,
  "date" TIMESTAMP(3) NOT NULL,
  "fees" DOUBLE PRECISION,
  "iso_currency_code" TEXT,
  "name" TEXT NOT NULL,
  "price" DOUBLE PRECISION,
  "quantity" DOUBLE PRECISION,
  "security_id" TEXT,
  "subtype" TEXT,
  "type" TEXT,
  "unofficial_currency_code" TEXT,
  "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "accountCode" TEXT,
  "subAccount" TEXT,
  FOREIGN KEY ("accountId") REFERENCES "accounts"("id"),
  FOREIGN KEY ("security_id") REFERENCES "securities"("securityId")
);
