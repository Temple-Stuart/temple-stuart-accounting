-- Phase 2: Add Prisma models for vendor options + trip type
-- Tables trip_lodging_options, trip_transfer_options, trip_vehicle_options,
-- trip_activity_expenses may already exist from raw SQL creation.
-- This migration adds the `status` column and `tripType` to trips.

-- Create enums
DO $$ BEGIN
  CREATE TYPE "TripType" AS ENUM ('personal', 'business', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "VendorOptionStatus" AS ENUM ('proposed', 'selected', 'committed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add tripType to trips table
ALTER TABLE "trips" ADD COLUMN IF NOT EXISTS "tripType" "TripType" NOT NULL DEFAULT 'personal';

-- Add status column to existing vendor option tables (if tables exist)
-- If tables don't exist, they'll be created below.

-- trip_lodging_options
DO $$ BEGIN
  ALTER TABLE "trip_lodging_options" ADD COLUMN IF NOT EXISTS "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed';
EXCEPTION WHEN undefined_table THEN
  -- Table doesn't exist yet, will be created below
  NULL;
END $$;

-- trip_transfer_options
DO $$ BEGIN
  ALTER TABLE "trip_transfer_options" ADD COLUMN IF NOT EXISTS "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- trip_vehicle_options
DO $$ BEGIN
  ALTER TABLE "trip_vehicle_options" ADD COLUMN IF NOT EXISTS "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- trip_activity_expenses
DO $$ BEGIN
  ALTER TABLE "trip_activity_expenses" ADD COLUMN IF NOT EXISTS "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed';
EXCEPTION WHEN undefined_table THEN
  NULL;
END $$;

-- Create tables if they don't exist (for fresh databases)
CREATE TABLE IF NOT EXISTS "trip_lodging_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" TEXT NOT NULL,
    "url" TEXT,
    "title" TEXT,
    "image_url" TEXT,
    "location" TEXT,
    "price_per_night" DECIMAL(12,2),
    "total_price" DECIMAL(12,2),
    "taxes_estimate" DECIMAL(12,2),
    "per_person" DECIMAL(12,2),
    "notes" TEXT,
    "votes_up" INTEGER NOT NULL DEFAULT 0,
    "votes_down" INTEGER NOT NULL DEFAULT 0,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_lodging_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trip_transfer_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" TEXT NOT NULL,
    "url" TEXT,
    "transfer_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "title" TEXT,
    "vendor" TEXT,
    "price" DECIMAL(12,2),
    "per_person" DECIMAL(12,2),
    "notes" TEXT,
    "votes_up" INTEGER NOT NULL DEFAULT 0,
    "votes_down" INTEGER NOT NULL DEFAULT 0,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_transfer_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trip_vehicle_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" TEXT NOT NULL,
    "url" TEXT,
    "vehicle_type" TEXT NOT NULL,
    "title" TEXT,
    "vendor" TEXT,
    "price_per_day" DECIMAL(12,2),
    "total_price" DECIMAL(12,2),
    "per_person" DECIMAL(12,2),
    "notes" TEXT,
    "votes_up" INTEGER NOT NULL DEFAULT 0,
    "votes_down" INTEGER NOT NULL DEFAULT 0,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_vehicle_options_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "trip_activity_expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trip_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT,
    "vendor" TEXT,
    "url" TEXT,
    "price" DECIMAL(12,2),
    "is_per_person" BOOLEAN NOT NULL DEFAULT true,
    "per_person" DECIMAL(12,2),
    "notes" TEXT,
    "votes_up" INTEGER NOT NULL DEFAULT 0,
    "votes_down" INTEGER NOT NULL DEFAULT 0,
    "is_selected" BOOLEAN NOT NULL DEFAULT false,
    "status" "VendorOptionStatus" NOT NULL DEFAULT 'proposed',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_activity_expenses_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "trip_lodging_options_trip_id_idx" ON "trip_lodging_options"("trip_id");
CREATE INDEX IF NOT EXISTS "trip_transfer_options_trip_id_idx" ON "trip_transfer_options"("trip_id");
CREATE INDEX IF NOT EXISTS "trip_vehicle_options_trip_id_idx" ON "trip_vehicle_options"("trip_id");
CREATE INDEX IF NOT EXISTS "trip_activity_expenses_trip_id_idx" ON "trip_activity_expenses"("trip_id");

-- Add foreign keys (if not already present)
DO $$ BEGIN
  ALTER TABLE "trip_lodging_options" ADD CONSTRAINT "trip_lodging_options_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trip_transfer_options" ADD CONSTRAINT "trip_transfer_options_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trip_vehicle_options" ADD CONSTRAINT "trip_vehicle_options_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trip_activity_expenses" ADD CONSTRAINT "trip_activity_expenses_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
