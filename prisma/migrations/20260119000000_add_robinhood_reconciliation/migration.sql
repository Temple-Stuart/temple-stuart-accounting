-- Add Robinhood reconciliation columns to investment_transactions
ALTER TABLE "investment_transactions" ADD COLUMN "rh_quantity" DOUBLE PRECISION;
ALTER TABLE "investment_transactions" ADD COLUMN "rh_price" DOUBLE PRECISION;
ALTER TABLE "investment_transactions" ADD COLUMN "rh_principal" DOUBLE PRECISION;
ALTER TABLE "investment_transactions" ADD COLUMN "rh_fees" DOUBLE PRECISION;
ALTER TABLE "investment_transactions" ADD COLUMN "rh_tran_fee" DOUBLE PRECISION;
ALTER TABLE "investment_transactions" ADD COLUMN "rh_contr_fee" DOUBLE PRECISION;
ALTER TABLE "investment_transactions" ADD COLUMN "rh_net_amount" DOUBLE PRECISION;
ALTER TABLE "investment_transactions" ADD COLUMN "rh_action" VARCHAR(10);
ALTER TABLE "investment_transactions" ADD COLUMN "reconciliation_status" VARCHAR(30);
ALTER TABLE "investment_transactions" ADD COLUMN "is_reconciled" BOOLEAN DEFAULT false;
ALTER TABLE "investment_transactions" ADD COLUMN "reconciled_at" TIMESTAMP;
ALTER TABLE "investment_transactions" ADD COLUMN "reconciled_by" VARCHAR(255);
