-- LINK-02 (2026-09-27) — A BOOKING IS LINKED TO THE BUDGET LINE IT FULFILS, BY A HUMAN.
--
-- A trip's planned lines (budget_line_items) and its real bookings (reservations)
-- had no key between them, so every line read "Saved" (TripBudgetActual.tsx) and
-- the travel lens could only speak per booking (trips/[id]/actuals/route.ts). This
-- table is that key. It is written ONLY by the owner's explicit action through
-- POST/DELETE /api/reservations/[id]/budget-link — never by a matcher, a score,
-- a name or an amount.
--
-- THE CARDINALITY, ENFORCED BY THE DATABASE: one booking fulfils AT MOST ONE line
-- (UNIQUE on "reservationId"); one line may be fulfilled by several bookings (two
-- hotel stays under one "Lodging" line) — no unique on "budgetLineItemId".
--
-- RESTRICT both ways: a linked line and a linked booking cannot vanish under the
-- link. Unlink first (the route records it).
--
-- "linkedAt" and "linkedBy" are stated by the route and carry NO default.
--
-- The two AuditActionType values name the link and the unlink; they are booking
-- events written through the one audit port (src/lib/reservations/auditTrail.ts).
--
-- Run as plain statements (psql's autocommit), not inside BEGIN/COMMIT: a new
-- enum value cannot be USED until the transaction that added it commits.
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; Alex runs this
-- via psql. NO BACKFILL: no booking was ever linked to a line before this table.

-- STEP 1: the table.
CREATE TABLE "reservation_budget_links" (
  "id"               UUID           NOT NULL DEFAULT gen_random_uuid(),
  "userId"           TEXT           NOT NULL,
  "reservationId"    UUID           NOT NULL,
  "budgetLineItemId" TEXT           NOT NULL,
  "linkedAt"         TIMESTAMPTZ(6) NOT NULL,
  "linkedBy"         VARCHAR(255)   NOT NULL,
  CONSTRAINT "reservation_budget_links_pkey" PRIMARY KEY ("id")
);

-- STEP 2: one line per booking.
CREATE UNIQUE INDEX "reservation_budget_links_reservationId_key" ON "reservation_budget_links"("reservationId");

-- STEP 3: the reads — a line's bookings, a user's links.
CREATE INDEX "reservation_budget_links_budgetLineItemId_idx" ON "reservation_budget_links"("budgetLineItemId");
CREATE INDEX "reservation_budget_links_userId_idx" ON "reservation_budget_links"("userId");

-- STEP 4: the foreign keys — RESTRICT both ways.
ALTER TABLE "reservation_budget_links" ADD CONSTRAINT "reservation_budget_links_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_budget_links" ADD CONSTRAINT "reservation_budget_links_budgetLineItemId_fkey"
  FOREIGN KEY ("budgetLineItemId") REFERENCES "budget_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- STEP 5: the link and the unlink are booking events.
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_budget_linked';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'reservation_budget_unlinked';
