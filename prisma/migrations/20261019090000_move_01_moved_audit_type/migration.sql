-- MOVE-01 (Alex, 2026-10-19) — "I'M MOVING": the audit vocabulary.
--
-- From a first day there, every current routine ends the day before (renamed
-- "<name> (to <day before>)" — one name per user) and, when carried over, runs
-- on as a copy in the new zone at the row's own times; a routine that starts
-- on or after that day is re-zoned instead; the stay covering the day before
-- is shortened and a new stay opened when a place is given. One transaction
-- (routines/move/route.ts), audited ONCE as operations_routines_moved — the
-- date, the zone, every ended routine with its copy or "no copy", the
-- re-zoned ids and the stay ids — beside the per-row audits the create,
-- update and stay paths already write. No table, column or row changes here.
--
-- AUTHORED here, applied at deploy (package.json build runs prisma migrate
-- deploy) — the RETRO-01 / ROUTINE-02b precedent. One value, idempotent.

ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_routines_moved';
