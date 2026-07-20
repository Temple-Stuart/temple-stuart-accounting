-- D3 (Alex-approved): reservations must hold non-hotel orders (flights) whose
-- rows have no stay window. Nullable-only relaxation — no renames, no drops,
-- no new columns, no data modification. Existing hotel rows are unaffected
-- (their values remain set; the LiteAPI book route still validates + writes
-- both dates).
ALTER TABLE "reservations" ALTER COLUMN "checkinDate" DROP NOT NULL;
ALTER TABLE "reservations" ALTER COLUMN "checkoutDate" DROP NOT NULL;
