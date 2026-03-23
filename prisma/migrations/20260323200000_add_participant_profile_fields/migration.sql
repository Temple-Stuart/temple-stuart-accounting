-- Phase 4A: Add traveler profile fields to trip_participants
-- These store the user's trip preferences so they survive page refresh.

ALTER TABLE "trip_participants" ADD COLUMN IF NOT EXISTS "profileTripType" VARCHAR(50);
ALTER TABLE "trip_participants" ADD COLUMN IF NOT EXISTS "profileBudget" VARCHAR(50);
ALTER TABLE "trip_participants" ADD COLUMN IF NOT EXISTS "profilePriorities" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "trip_participants" ADD COLUMN IF NOT EXISTS "profileVibe" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "trip_participants" ADD COLUMN IF NOT EXISTS "profilePace" VARCHAR(20);
ALTER TABLE "trip_participants" ADD COLUMN IF NOT EXISTS "profileGroupSize" INTEGER DEFAULT 1;
