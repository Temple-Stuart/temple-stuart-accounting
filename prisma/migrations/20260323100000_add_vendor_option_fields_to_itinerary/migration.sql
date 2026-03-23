-- Phase 3: Add vendor option tracking fields to trip_itinerary
-- Links itinerary entries back to the vendor option that created them

ALTER TABLE "trip_itinerary" ADD COLUMN IF NOT EXISTS "vendorOptionId" VARCHAR(100);
ALTER TABLE "trip_itinerary" ADD COLUMN IF NOT EXISTS "vendorOptionType" VARCHAR(20);

CREATE INDEX IF NOT EXISTS "trip_itinerary_vendorOptionId_idx" ON "trip_itinerary"("vendorOptionId");
