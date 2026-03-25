-- Add photos column to places_cache for storing photo references
ALTER TABLE "places_cache" ADD COLUMN IF NOT EXISTS "photos" TEXT;
