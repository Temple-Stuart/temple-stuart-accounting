-- AlterTable: Add name-based destination fields to trip_destinations
-- Allows destinations from the search bar (city names with coordinates)
-- to be stored alongside resort-based destinations

ALTER TABLE "trip_destinations" ADD COLUMN "name" VARCHAR(255);
ALTER TABLE "trip_destinations" ADD COLUMN "country" VARCHAR(100);
ALTER TABLE "trip_destinations" ADD COLUMN "latitude" DECIMAL(10, 7);
ALTER TABLE "trip_destinations" ADD COLUMN "longitude" DECIMAL(10, 7);

-- Make resortId nullable (name-based destinations don't have one)
ALTER TABLE "trip_destinations" ALTER COLUMN "resortId" DROP NOT NULL;
