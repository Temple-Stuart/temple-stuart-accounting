-- T-D7: deleting a trip must never destroy booking records. reservations rows
-- are financial records of real provider bookings (paid money); the original
-- FK cascaded them away with the trip. SET NULL orphans them instead —
-- recoverable and truthful. Constraint name and ON UPDATE behavior taken from
-- the original DDL (20260528000000_travel_reservations_commission_ledger/
-- migration.sql:37-38). tripId is already nullable. No data is modified.
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_tripId_fkey";
ALTER TABLE "reservations"
    ADD CONSTRAINT "reservations_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
