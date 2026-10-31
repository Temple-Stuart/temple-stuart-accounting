-- STATUS-01 (2026-09-26) — THE VENDOR'S CURRENT TRUTH REACHES EVERY RESERVATION.
--
-- Post-booking status was read at exactly two moments (the flight book route's
-- one refresh, the cancel route's one GET after a 202) and never on a schedule;
-- there was no vendor webhook. A hotel's confirmation number that arrives late
-- showed "—" forever, a flight was never marked ticketed, a cancel_pending never
-- resolved.
--
-- 1. reservations — five columns, all NULL until the vendor states the fact:
--      ticketedAt              the airline's ticketData.ticketedAt (UTC), verbatim
--      ticketLimitTime         the airline's ticketLimitTime — "deadline for ticket
--                              issuance (UTC)", verbatim
--      lastVendorReadAt        when the last GET of this booking ARRIVED (the
--                              landed response's own timestamp, never our clock in
--                              the leaf); the scheduled refresh orders by it, NULL
--                              first
--      ticketedEmailSentAt     the marker that the ONE 'ticketed' email attempt was
--                              made — stamped in the same transaction as the change
--                              that earned it, and read under the row lock the read
--                              leaf takes (SELECT ... FOR UPDATE, STATUS-01b): the
--                              marker plus that lock is what makes the send once; a
--                              failed send is written to audit_log by name and is
--                              NOT retried automatically
--      confirmationEmailSentAt the same marker for 'hotel_confirmation_arrived'
--
-- 2. webhook_events — one row per delivery the receiver acted on (or refused by
--    name after landing). eventId is the dedupe: a PARTIAL UNIQUE index over the
--    rows that were not themselves duplicates, so a redelivery is recorded as its
--    own row with outcome 'duplicate' (every delivery is on record) while at most
--    ONE row per event_id can ever have acted. arrivalId is NOT NULL and a foreign
--    key: the delivery's bytes landed BEFORE anything was parsed, and the row
--    points at them. outcome is CHECK-constrained to exactly the six words the
--    receiver can answer with.
--
-- A WEBHOOK IS A HINT; THE GET IS THE TRUTH. Nothing here stores a payload field
-- as a fact about a booking: bookingId is the id the receiver resolved from the
-- delivery in order to find OUR reservation and re-read the vendor.
--
-- NO DEFAULTS on any stated field (id and receivedAt are the row's own). Nothing
-- backfilled: the retro (scripts/status-01-retro-reservations.ts) reads every
-- reservation from the vendor; nothing is inferred here.

ALTER TABLE "reservations" ADD COLUMN "ticketedAt" TIMESTAMPTZ(6);
ALTER TABLE "reservations" ADD COLUMN "ticketLimitTime" TIMESTAMPTZ(6);
ALTER TABLE "reservations" ADD COLUMN "lastVendorReadAt" TIMESTAMPTZ(6);
ALTER TABLE "reservations" ADD COLUMN "ticketedEmailSentAt" TIMESTAMPTZ(6);
ALTER TABLE "reservations" ADD COLUMN "confirmationEmailSentAt" TIMESTAMPTZ(6);

CREATE TABLE "webhook_events" (
    "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
    "provider"   VARCHAR(20)    NOT NULL,
    "eventId"    VARCHAR(160)   NOT NULL,
    "eventType"  VARCHAR(80)    NOT NULL,
    "bookingId"  VARCHAR(120),
    "arrivalId"  TEXT           NOT NULL,
    "receivedAt" TIMESTAMPTZ(6) NOT NULL,
    "actedAt"    TIMESTAMPTZ(6),
    "outcome"    VARCHAR(20)    NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "webhook_events_outcome" CHECK ("outcome" IN ('applied', 'unchanged', 'unknown_booking', 'unknown_event', 'duplicate', 'read_failed'))
);

-- THE DEDUPE: one acted row per event_id; a redelivery lands as its own 'duplicate' row.
CREATE UNIQUE INDEX "webhook_events_eventId_acted_key" ON "webhook_events"("eventId") WHERE "outcome" <> 'duplicate';
CREATE INDEX "webhook_events_eventId_idx" ON "webhook_events"("eventId");
CREATE INDEX "webhook_events_bookingId_idx" ON "webhook_events"("bookingId");
CREATE INDEX "webhook_events_receivedAt_idx" ON "webhook_events"("receivedAt");
CREATE INDEX "webhook_events_arrivalId_idx" ON "webhook_events"("arrivalId");

ALTER TABLE "webhook_events"
    ADD CONSTRAINT "webhook_events_arrivalId_fkey"
    FOREIGN KEY ("arrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
