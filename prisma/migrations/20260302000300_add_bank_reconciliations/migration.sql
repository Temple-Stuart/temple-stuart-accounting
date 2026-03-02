-- AlterTable: Add entity_id FK to accounts
ALTER TABLE "accounts" ADD COLUMN "entity_id" TEXT;

-- CreateIndex
CREATE INDEX "accounts_userId_entity_id_idx" ON "accounts"("userId", "entity_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- CreateTable
CREATE TABLE "bank_reconciliations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "statement_balance" DECIMAL(14,2) NOT NULL,
    "book_balance" DECIMAL(14,2) NOT NULL,
    "adjusted_bank" DECIMAL(14,2) NOT NULL,
    "adjusted_book" DECIMAL(14,2) NOT NULL,
    "difference" DECIMAL(14,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "reconciled_at" TIMESTAMP(3),
    "reconciled_by" TEXT,
    "items" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bank_reconciliations_userId_entity_id_account_id_year_month_key" ON "bank_reconciliations"("userId", "entity_id", "account_id", "year", "month");

-- CreateIndex
CREATE INDEX "bank_reconciliations_userId_entity_id_status_idx" ON "bank_reconciliations"("userId", "entity_id", "status");

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
