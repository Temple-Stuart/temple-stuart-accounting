-- POST-01 (2026-09-26) — A POSTING CARRIES ITS DOCUMENT: THE BOOKING BEHIND THE
-- BANK ROW.
--
-- THE RULING. The only thing that posts to the books is a Plaid transaction. A
-- booking is the SOURCE DOCUMENT of that posting, never a posting of its own; the
-- seven source kinds stay seven and nothing here adds an eighth.
--
-- THE DEFECT. commitPlaidTransaction (src/lib/journal-entry-service.ts) writes a
-- plaid_txn entry and knows nothing of reservations; a transaction_reservation_link
-- reaches 'accepted' (src/app/api/runway/match/review/route.ts) and then nothing
-- happens; journal_entries has no document column; a refund inflow has no path.
--
-- 1. journal_entries.document_reservation_id — the booking this posting is the
--    charge (or refund) of. NULL = no document (a posting of no booking, or one
--    posted before this column existed and not yet given its document by the retro).
--    RESTRICT: a booking that documents a posting cannot be deleted.
-- 2. journal_entries.document_money_event_id — NULL = the booking's CHARGE; set =
--    that money event, a REFUND (the vendor's stated fact, money_events.kind
--    'refund'). RESTRICT. The CHECK says a money event never documents a posting
--    without its booking.
-- 3. ONE POSTED CHARGE PER BOOKING — the partial unique on document_reservation_id
--    WHERE the money event is NULL and status = 'posted'. A reversed entry (status
--    'reversed', the uncommit) leaves the index, so a re-commit after an uncommit
--    posts the charge again; a second charge for a booking already posted is
--    refused by the database and named by the writer (P2002 → a ValidationError,
--    never a 500).
-- 4. transaction_reservation_links.moneyEventId — NULL = the link is the booking's
--    charge (every link MATCH-1 proposes today); set = that money event, a refund
--    (MATCH-02 proposes these; not built). RESTRICT.
--
-- THE IMMUTABILITY TRIGGER (20260227000100_protect_journal_entries) names the
-- fields it freezes; these two are not among them, so the retro
-- (scripts/post-01-retro-documents.ts) may set a document on an entry posted
-- before this column existed. The trigger is NOT changed here.
--
-- NO DEFAULTS, NOTHING BACKFILLED HERE. The retro fills a document only from an
-- accepted link — deterministic, no vendor read — and prints every row.
--
-- Applied by Alex via psql (Claude Code authors the file only; it cannot reach Azure).

ALTER TABLE "journal_entries" ADD COLUMN "document_reservation_id" UUID;
ALTER TABLE "journal_entries" ADD COLUMN "document_money_event_id" UUID;

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_document_reservation_id_fkey"
    FOREIGN KEY ("document_reservation_id") REFERENCES "reservations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_document_money_event_id_fkey"
    FOREIGN KEY ("document_money_event_id") REFERENCES "money_events"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- A money event never documents a posting without its booking.
ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_document_money_event_needs_reservation"
    CHECK ("document_money_event_id" IS NULL OR "document_reservation_id" IS NOT NULL);

-- One POSTED charge entry per booking. A reversed entry leaves the index.
CREATE UNIQUE INDEX "journal_entries_document_charge_key"
    ON "journal_entries"("document_reservation_id")
    WHERE "document_money_event_id" IS NULL AND "status" = 'posted';

CREATE INDEX "journal_entries_document_reservation_id_idx" ON "journal_entries"("document_reservation_id");
CREATE INDEX "journal_entries_document_money_event_id_idx" ON "journal_entries"("document_money_event_id");

ALTER TABLE "transaction_reservation_links" ADD COLUMN "moneyEventId" UUID;

ALTER TABLE "transaction_reservation_links"
    ADD CONSTRAINT "transaction_reservation_links_moneyEventId_fkey"
    FOREIGN KEY ("moneyEventId") REFERENCES "money_events"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "transaction_reservation_links_moneyEventId_idx" ON "transaction_reservation_links"("moneyEventId");
