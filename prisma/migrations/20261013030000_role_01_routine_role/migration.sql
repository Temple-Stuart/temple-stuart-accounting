-- ROLE-01 (2026-10-13) — THE ROUTINE'S ROLE: what kind of stop it is on the day card.
--
-- Alex's day has five kinds of stop, and the card asked every one the same
-- questions. The role, set once on the routine (the Tasks tab), decides what the
-- step card asks and whether the routine is a stop at all:
--   journal  — the morning questions (the journal plate reads the answers)
--   plan     — the execution plan: the vision in, the plan out
--   execute  — a work block: what was finished up to the break
--   place    — somewhere you go and pay: the vendor, the amount, the stars
--   all_day  — a subscription or a membership: in the day's plan, NOT a stop
--              (no time slot, nothing to record — the "also today" band)
--   none     — a stop with the plain record (done, when, minutes, a note)
-- A line of a routine takes its routine's role. Nothing here changes any
-- schedule, amount or place; every existing routine reads 'none' — its card is
-- exactly what it was.
--
-- HELD HERE: the six values (CHECK). NOT NULL with a default, so no row is
-- rewritten and no code path meets a null role.
--
-- AUTHORED here, applied at deploy (package.json:11 runs prisma migrate deploy
-- before next build). NO BACKFILL: 'none' is the default, and it is the truth
-- for every routine until Alex sets one.

ALTER TABLE "operations_routines"
  ADD COLUMN "role" VARCHAR(10) NOT NULL DEFAULT 'none';

ALTER TABLE "operations_routines"
  ADD CONSTRAINT "operations_routines_role" CHECK ("role" IN ('journal', 'plan', 'execute', 'place', 'all_day', 'none'));
