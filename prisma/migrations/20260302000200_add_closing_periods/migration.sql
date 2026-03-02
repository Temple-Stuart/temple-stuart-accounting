-- CreateTable
CREATE TABLE "closing_periods" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'closed',
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_by" TEXT,
    "reopened_at" TIMESTAMP(3),
    "reopened_by" TEXT,
    "notes" TEXT,

    CONSTRAINT "closing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "closing_periods_userId_entity_id_year_month_key" ON "closing_periods"("userId", "entity_id", "year", "month");

-- CreateIndex
CREATE INDEX "closing_periods_userId_entity_id_status_idx" ON "closing_periods"("userId", "entity_id", "status");

-- AddForeignKey
ALTER TABLE "closing_periods" ADD CONSTRAINT "closing_periods_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "closing_periods" ADD CONSTRAINT "closing_periods_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
