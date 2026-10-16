-- RETRO-01 (Alex, 2026-10-16) — A STRANDED RECORD RE-ATTACHES TO ITS STOP: the audit vocabulary.
--
-- A stop record is keyed to its occurrence instant (STOP-01). When a routine's
-- time or start date changes, a record typed before matches no stop any more:
-- the day card names it, the ledger shows its row with no COA, vendor or
-- budget. The stops/[id] PATCH moves the record's occurrence_at to the instant
-- of that plan's stop on the day — proven by routineDay, refused by name when a
-- record already sits there, the completion mirror moved in the same
-- transaction — and audits the move as operations_stop_moved (before → after).
-- Nothing else on the record changes; no table, column or row changes here.
--
-- AUTHORED here, applied at deploy (package.json build runs prisma migrate
-- deploy) — the STOP-01 precedent (20261012140000, STEP 3). One value, idempotent.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stop_moved';
