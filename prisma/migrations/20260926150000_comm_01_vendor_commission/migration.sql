-- COMM-01 (2026-09-26) — THE COMMISSION IS THE VENDOR'S STATED FIGURE, NEVER A
-- ZERO, AND IT LOCKS WHEN THE VENDOR SAYS IT LOCKS.
--
-- THE DEFECT. commissionAmountCents was NOT NULL, so a commission the vendor did
-- not state could not be said: the hotel book route fabricated one through a
-- fallback chain (the vendor's figure, else a figure the BROWSER posted, else a
-- literal 0) and the flight book route wrote a literal 0. Nothing ever read the
-- commission the vendor states after booking, nothing ever wrote 'confirmed',
-- and status had no CHECK.
--
-- THE VENDOR'S RULE (docs.liteapi.travel/docs/revenue-management-and-commission):
-- "A booking is confirmed when a guest completes their stay and checks out of the
-- hotel. Once this happens, your commission will be locked in and included in
-- the next weekly payout." GET /bookings/{id} states, per booking, `commission`
-- ("The total commission amount associated with all rooms on the booking"),
-- `distributorCommission` ("Commission amount for the distributor"),
-- `clientCommission` ("Commission amount for the client") and `processingFee`
-- ("Processing fee for the booking").
--
-- 1. commissionAmountCents — DROP NOT NULL. NULL = the vendor stated no
--    commission at booking (a flight: NOT DOCUMENTED; a hotel answer without the
--    field). The book-time figure is never overwritten.
-- 2. The lock, verbatim from the read that locked it, NULL until then:
--      lockedCommissionCents        the vendor's `commission`, in cents
--      distributorCommissionCents   `distributorCommission`, when stated
--      clientCommissionCents        `clientCommission`, when stated
--      processingFeeCents           `processingFee`, when stated
--      lockedAt                     that read's landed instant (never our clock)
--      lockArrivalId                that read's arrival (liteapi · booking_read)
--                                   — the evidence; FK RESTRICT
-- 3. status — CHECK over the four documented words, now enforced. Every row
--    written to date carries 'estimated' (the two book routes) or 'cancelled'
--    (the cancel route and the apply leaf); nothing ever wrote another word.
--    Pre-flight, before deploy:
--      SELECT status, count(*) FROM commission_ledger GROUP BY 1;
--    must list only estimated / cancelled.
--
-- NO DEFAULTS on any stated field. NO BACKFILL: the retro
-- (scripts/status-01-retro-reservations.ts) reads every reservation from the
-- vendor and the apply leaf locks what the vendor states; nothing is inferred.
-- 'paid' is NOT written by this ruling: it is the bank inflow matched to the
-- weekly payout (MATCH-02 / POST-01); payoutDate and providerInvoiceRef stay NULL.

ALTER TABLE "commission_ledger" ALTER COLUMN "commissionAmountCents" DROP NOT NULL;

ALTER TABLE "commission_ledger" ADD COLUMN "lockedCommissionCents"      INTEGER;
ALTER TABLE "commission_ledger" ADD COLUMN "distributorCommissionCents" INTEGER;
ALTER TABLE "commission_ledger" ADD COLUMN "clientCommissionCents"      INTEGER;
ALTER TABLE "commission_ledger" ADD COLUMN "processingFeeCents"         INTEGER;
ALTER TABLE "commission_ledger" ADD COLUMN "lockedAt"                   TIMESTAMPTZ(6);
ALTER TABLE "commission_ledger" ADD COLUMN "lockArrivalId"              TEXT;

CREATE INDEX "commission_ledger_lockArrivalId_idx" ON "commission_ledger"("lockArrivalId");

ALTER TABLE "commission_ledger"
    ADD CONSTRAINT "commission_ledger_lockArrivalId_fkey"
    FOREIGN KEY ("lockArrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- THE FOUR DOCUMENTED WORDS, ENFORCED.
ALTER TABLE "commission_ledger"
    ADD CONSTRAINT "commission_ledger_status"
    CHECK ("status" IN ('estimated', 'confirmed', 'paid', 'cancelled'));
