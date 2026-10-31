-- LEDGER-03 (Alex, 2026-10-19) — THE LINK IS AUDITED: the audit vocabulary.
--
-- "Match — amount from Books … never auto link due to risk for error." A stop
-- record's Match is the posting that settled it, linked BY HAND through the
-- LINK-01 route (src/app/api/calendar/links/route.ts) on planned_item_links —
-- the table the books already hold. A link is a financial assertion, so from
-- this ruling the route's POST writes planned_item_linked and its DELETE
-- planned_item_unlinked (writeAuditLog: the actor, the table, the row's id,
-- and the payload { kind, id, instant, journal_entry_id, amountCents }). No
-- table, no column, no row here — two enum values, idempotent.
--
-- A new enum value cannot be used in the same transaction that adds it
-- (Postgres: "unsafe use of new value"). Nothing here uses them: the route
-- writes them at request time, after this migration has committed at deploy.
-- AUTHORED here, applied at deploy (package.json build runs prisma migrate
-- deploy) — the MOVE-01 / ROUTINE-02b / RETRO-01 precedent.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'planned_item_linked';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'planned_item_unlinked';
