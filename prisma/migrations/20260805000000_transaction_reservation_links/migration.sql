-- MATCH-0: transaction_reservation_links — the booking↔bank matching spine
-- (VISION-AUDIT-1 arc). ONE table carrying the FULL proposal lifecycle
-- (proposed → accepted/rejected with confidence, rationale, reviewer stamps)
-- so MATCH-1 (matcher), MATCH-2 (review queue) and MATCH-3 (travel-lens
-- rollup) need NO further schema — this is the arc's only migration.
--
-- ADDITIVE-ONLY (the HARD-GATE posture, DIM-1 precedent): one new table.
-- Zero data rewrites, zero changes to existing rows or tables.
--
-- Applied by Alex via psql (repo law: schema.prisma + this SQL move together;
-- Claude Code authors the file only — it cannot reach Azure).
--
-- id types matched to their targets (verified against schema.prisma):
--   transactions.id  TEXT  (String @id — Plaid ids, no @db.Uuid; schema:415)
--   reservations.id  UUID  (schema:1289)
--   users.id         TEXT  (String @id; schema:493)
--
-- FK posture: RESTRICT on transaction + reservation (ledger_line_links
-- precedent) — a matched money row can never vanish silently; deleting a
-- linked row fails LOUDLY until the link is resolved. CASCADE on users (the
-- reservations.userId precedent) — a deleted owner takes their links along.
-- The status CHECK enforces the three lifecycle values at the database.

CREATE TABLE "transaction_reservation_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transactionId" TEXT NOT NULL,
    "reservationId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'proposed',
    "confidence" DOUBLE PRECISION,
    "matchRationale" TEXT,
    "reviewNotes" TEXT,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" VARCHAR(255),

    CONSTRAINT "transaction_reservation_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "transaction_reservation_links_status_chk"
        CHECK ("status" IN ('proposed', 'accepted', 'rejected'))
);

ALTER TABLE "transaction_reservation_links"
    ADD CONSTRAINT "transaction_reservation_links_transactionId_fkey"
    FOREIGN KEY ("transactionId") REFERENCES "transactions"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transaction_reservation_links"
    ADD CONSTRAINT "transaction_reservation_links_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "reservations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "transaction_reservation_links"
    ADD CONSTRAINT "transaction_reservation_links_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- One lifecycle row per (transaction, reservation) pair — matcher re-runs
-- upsert into the same row and can never duplicate a proposal.
CREATE UNIQUE INDEX "transaction_reservation_links_transactionId_reservationId_key"
    ON "transaction_reservation_links"("transactionId", "reservationId");

-- The review queue (userId + status) and the MATCH-3 anti-join.
CREATE INDEX "transaction_reservation_links_userId_status_idx"
    ON "transaction_reservation_links"("userId", "status");

-- "Booked" lookups: does this reservation have an accepted link?
CREATE INDEX "transaction_reservation_links_reservationId_idx"
    ON "transaction_reservation_links"("reservationId");
