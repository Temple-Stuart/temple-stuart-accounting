-- Add profileActivities to trip_participants
ALTER TABLE "trip_participants" ADD COLUMN IF NOT EXISTS "profileActivities" TEXT[] DEFAULT '{}';
