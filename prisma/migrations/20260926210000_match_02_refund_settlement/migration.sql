-- MATCH-02 (2026-09-26) — REFUNDS COME HOME: an inflow is proposed against the
-- refund the vendor stated, a human accepts, the money event settles.
--
-- THE GAP. CANCEL-01 gave money_events a status vocabulary — 'stated' (the vendor
-- said it) and 'settled' (the bank confirmed it) — and NOTHING ever wrote
-- 'settled': the matcher proposes outflows only (reservationMatcher.ts:165), so a
-- refund that lands in the bank is never proposed, never accepted, never settled.
--
-- 1. money_events.settledTransactionId — the bank row a human ACCEPTED as this
--    refund (transactions.id, the same id transaction_reservation_links names).
--    FK RESTRICT: the evidence of a settlement cannot vanish.
-- 2. money_events.settledAt — the accept instant, the review route's own clock
--    (the one writer of 'settled': src/app/api/runway/match/review/route.ts).
-- 3. THE CHECK — settled means evidence, and evidence means settled:
--    (status = 'settled') = (settledTransactionId IS NOT NULL). A row cannot say
--    'settled' without the bank row that settled it, and cannot carry a bank row
--    while still saying 'stated'.
--
-- NO DEFAULTS, NOTHING BACKFILLED. Every refund row today is 'stated' with NULL
-- evidence and stays so until a human accepts a proposal for it.
--
-- Applied by Alex via psql (Claude Code authors the file only; it cannot reach Azure).

ALTER TABLE "money_events" ADD COLUMN "settledTransactionId" TEXT;
ALTER TABLE "money_events" ADD COLUMN "settledAt" TIMESTAMPTZ(6);

ALTER TABLE "money_events"
    ADD CONSTRAINT "money_events_settledTransactionId_fkey"
    FOREIGN KEY ("settledTransactionId") REFERENCES "transactions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Settled means evidence, and evidence means settled.
ALTER TABLE "money_events"
    ADD CONSTRAINT "money_events_settled_has_evidence"
    CHECK (("status" = 'settled') = ("settledTransactionId" IS NOT NULL));

CREATE INDEX "money_events_settledTransactionId_idx" ON "money_events"("settledTransactionId");
