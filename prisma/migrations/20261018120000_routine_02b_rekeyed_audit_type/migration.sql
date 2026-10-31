-- ROUTINE-02b (Alex, 2026-10-18) — HISTORY FOLLOWS THE TIME: the audit vocabulary.
--
-- Four tables are keyed to a routine's occurrence instants: its completions
-- (expected_at), its stop records (occurrence_at), its single-occurrence plan
-- vendors (occurrence_at) and the postings linked to an occurrence
-- (planned_item_links.target_instant). When the routine's clock (its start
-- time → BYHOUR/BYMINUTE) or its zone changes, the routines/[id] PATCH moves
-- every such row to the new rule's instant on the SAME local day, in one
-- transaction with the routine's row — refused by name before any write when
-- a target is occupied or a day has no occurrence under the new rule — and
-- audits the move ONCE as operations_routine_rekeyed (the counts per table,
-- the rule and zone before → after), beside RETRO-01's operations_stop_moved
-- per record. No table, column or row changes here.
--
-- AUTHORED here, applied at deploy (package.json build runs prisma migrate
-- deploy) — the RETRO-01 precedent (20261016120000). One value, idempotent.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routine_rekeyed';
