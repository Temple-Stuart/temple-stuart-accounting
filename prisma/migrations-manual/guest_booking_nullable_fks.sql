-- PR-G1 — Guest booking foundation (schema migration only, no booking logic).
-- Makes hotel booking able to PERSIST a guest (no account, no trip):
--   • reservations.userId        -> nullable  (a guest has no account)
--   • reservations.tripId        -> nullable  (a guest has no trip)
--   • commission_ledger.userId   -> nullable  (margin earned regardless of account)
--   • reservations.bookingType   -> NEW 'guest' | 'account' tag (default 'account')
--   • reservations.guestEmail    -> NEW contact email for guest bookings (nullable)
--
-- All operations are NON-DESTRUCTIVE (DROP NOT NULL + ADD COLUMN). Existing rows
-- stay valid; bookingType backfills to 'account' for them. Foreign keys + their
-- ON DELETE CASCADE actions are UNCHANGED — DROP NOT NULL only relaxes the column.
--
-- RUN THIS FIRST (via the Azure psql wrapper), confirm with the verify query at the
-- bottom, THEN merge — so origin/main's schema.prisma matches the live DB when
-- Vercel runs `prisma migrate deploy`.
--
-- Mirrors prisma/schema.prisma `model reservations` + `model commission_ledger`.

BEGIN;

-- 1) Relax the three NOT-NULL foreign-key columns to nullable.
ALTER TABLE "reservations"      ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "reservations"      ALTER COLUMN "tripId" DROP NOT NULL;
ALTER TABLE "commission_ledger" ALTER COLUMN "userId" DROP NOT NULL;

-- 2) Add the guest-vs-account tag (NOT NULL with a default → existing rows backfill).
ALTER TABLE "reservations" ADD COLUMN "bookingType" VARCHAR(20) NOT NULL DEFAULT 'account';

-- 3) Add the guest contact email (nullable — only set for guest bookings).
ALTER TABLE "reservations" ADD COLUMN "guestEmail" VARCHAR(255);

COMMIT;

-- ─── VERIFY (run after COMMIT) ───────────────────────────────────────────────
-- Expect: userId = YES, tripId = YES, bookingType = NO (default 'account'),
--         guestEmail = YES.
SELECT column_name, is_nullable, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'reservations'
  AND column_name IN ('userId', 'tripId', 'bookingType', 'guestEmail')
ORDER BY column_name;

-- Expect: userId = YES.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'commission_ledger'
  AND column_name = 'userId';
