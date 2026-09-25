-- CANCEL-01 (2026-09-26) — A CANCEL KEEPS THE MONEY FACTS.
--
-- THE DEFECT. The hotel cancel answer states cancellation_fee and refund_amount;
-- the route landed those bytes as an arrival and then discarded them — no column,
-- no row. The flight cancel (CANCEL-01 COMMIT 3) states a refund, a penalty, where
-- the refund goes, and airline vouchers. None of it had anywhere to live.
--
-- 1. money_events — ONE ROW PER MONEY FACT A VENDOR STATES ABOUT A RESERVATION.
--    kind names the fact (charge · refund · cancellation_fee · change_fee ·
--    servicing_fee · ticketing_fee · voucher_issued); amountCents is what the vendor
--    stated, or NULL when it stated none — NEVER 0 for "unknown"; currency and
--    refundDestination are the vendor's own words (the destination enum is LiteAPI's:
--    original_payment · agency_deposit · voucher · bsp_settlement · manual · unknown),
--    stored verbatim or NULL. status is 'stated' (the vendor said it) or 'settled'
--    (the bank confirmed it — item 8, refund matching, NOT this PR). arrivalId is NOT
--    NULL and a foreign key: no money fact without the answer it was read from.
--    reservationId is RESTRICT: a reservation with money facts cannot be deleted.
--    statedAt is the instant the vendor's answer arrived (the arrival's own clock).
--
-- 2. vouchers — A TABLE, NOT A JSON COLUMN. An airline voucher is money the customer
--    holds with an expiry; the benchmark (Perk / Ramp travel) keeps vouchers
--    queryable by expiry so a balance about to lapse can be surfaced. A JSON column
--    on money_events would bury expiresAt where no index and no simple WHERE can
--    reach it. passengerNames is JSONB, NULL when the vendor stated none (a scalar
--    list in Prisma cannot be NULL and would default to [] — a fabricated "nobody").
--
-- 3. reservations.cancelIntentAt — the vendor's own timestamp ("set when a
--    cancellation was requested and is awaiting airline confirmation", GET
--    /flights/bookings/{bookingId}), stored when a flight cancel answers 202 and the
--    booking stays CONFIRMED at the airline. NULL otherwise.
--
-- 4. STATUS VOCABULARIES, VERIFIED: reservations.status has NO CHECK constraint
--    (only a schema comment names 'pending' | 'confirmed' | 'cancelled' | 'failed'),
--    so 'cancel_pending' needs no widening here; commission_ledger.status has NO
--    CHECK either ('estimated' | 'confirmed' | 'paid' by comment), so 'cancelled'
--    needs none. Both comments are widened in schema.prisma.
--
-- NO DEFAULTS on any stated field (id and createdAt are the row's own, not a
-- statement). Nothing backfilled: the money facts of cancellations already landed
-- stay in their arrivals; nothing is inferred from them here.

ALTER TABLE "reservations" ADD COLUMN "cancelIntentAt" TIMESTAMPTZ(6);

CREATE TABLE "money_events" (
    "id"                UUID         NOT NULL DEFAULT gen_random_uuid(),
    "reservationId"     UUID         NOT NULL,
    "lane"              VARCHAR(20)  NOT NULL,
    "kind"              VARCHAR(20)  NOT NULL,
    "amountCents"       INTEGER,
    "currency"          VARCHAR(3),
    "refundDestination" VARCHAR(20),
    "status"            VARCHAR(10)  NOT NULL,
    "vendorReference"   VARCHAR(120),
    "arrivalId"         TEXT         NOT NULL,
    "statedAt"          TIMESTAMPTZ(6) NOT NULL,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "money_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "money_events_lane" CHECK ("lane" IN ('hotel', 'flight', 'activity')),
    CONSTRAINT "money_events_kind" CHECK ("kind" IN ('charge', 'refund', 'cancellation_fee', 'change_fee', 'servicing_fee', 'ticketing_fee', 'voucher_issued')),
    CONSTRAINT "money_events_status" CHECK ("status" IN ('stated', 'settled')),
    CONSTRAINT "money_events_refundDestination" CHECK ("refundDestination" IS NULL OR "refundDestination" IN ('original_payment', 'agency_deposit', 'voucher', 'bsp_settlement', 'manual', 'unknown'))
);

CREATE INDEX "money_events_reservationId_idx" ON "money_events"("reservationId");
CREATE INDEX "money_events_arrivalId_idx" ON "money_events"("arrivalId");
CREATE INDEX "money_events_kind_status_idx" ON "money_events"("kind", "status");

ALTER TABLE "money_events"
    ADD CONSTRAINT "money_events_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "money_events"
    ADD CONSTRAINT "money_events_arrivalId_fkey"
    FOREIGN KEY ("arrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "vouchers" (
    "id"              UUID         NOT NULL DEFAULT gen_random_uuid(),
    "reservationId"   UUID         NOT NULL,
    "vendorVoucherId" VARCHAR(120),
    "code"            VARCHAR(120) NOT NULL,
    "airline"         VARCHAR(8),
    "amountCents"     INTEGER,
    "currency"        VARCHAR(3),
    "validFrom"       DATE,
    "expiresAt"       DATE,
    "passengerNames"  JSONB,
    "notes"           TEXT,
    "arrivalId"       TEXT         NOT NULL,
    "statedAt"        TIMESTAMPTZ(6) NOT NULL,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "vouchers_reservationId_idx" ON "vouchers"("reservationId");
CREATE INDEX "vouchers_expiresAt_idx" ON "vouchers"("expiresAt");
CREATE INDEX "vouchers_arrivalId_idx" ON "vouchers"("arrivalId");

ALTER TABLE "vouchers"
    ADD CONSTRAINT "vouchers_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vouchers"
    ADD CONSTRAINT "vouchers_arrivalId_fkey"
    FOREIGN KEY ("arrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
