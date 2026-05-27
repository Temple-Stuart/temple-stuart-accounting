-- Travel-Data-PR-1: hard monthly Google Places bill-protection counter.
-- One row per UTC calendar month; incremented per outbound Google call and
-- checked against GOOGLE_PLACES_MONTHLY_CAP. Additive only — new table, no
-- backfill, safe on `prisma migrate deploy`.

CREATE TABLE "google_places_usage" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "callCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_places_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "google_places_usage_yearMonth_key" ON "google_places_usage"("yearMonth");
