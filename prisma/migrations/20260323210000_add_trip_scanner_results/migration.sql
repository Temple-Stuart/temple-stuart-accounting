-- CreateTable
CREATE TABLE IF NOT EXISTS "trip_scanner_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tripId" TEXT NOT NULL,
    "destination" VARCHAR(200) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "recommendations" JSONB NOT NULL,
    "scannedBy" VARCHAR(200) NOT NULL,
    "minRating" DOUBLE PRECISION NOT NULL DEFAULT 4.0,
    "minReviews" INTEGER NOT NULL DEFAULT 50,
    "profileSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_scanner_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trip_scanner_results_tripId_idx" ON "trip_scanner_results"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "trip_scanner_results_tripId_destination_category_key" ON "trip_scanner_results"("tripId", "destination", "category");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trip_scanner_results_tripId_fkey'
  ) THEN
    ALTER TABLE "trip_scanner_results" ADD CONSTRAINT "trip_scanner_results_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
