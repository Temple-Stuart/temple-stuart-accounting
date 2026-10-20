-- BACKLOG-01b (Alex, 2026-10-20) — THE BRIEF ON TOP OF BACKLOG-01.
--
-- Alex, 15:27: the morning card is "the running log of ongoing projects and
-- tasks not done — rank them, add to them, adjust scope as things evolve, pick
-- today's"; the evening card's prompt "audits the work from sitting down to
-- finishing; articulate changes in direction and why, verify they make sense,
-- add them to the projects". The chat returns the NEXT PROJECTS in THE BRIEF
-- FORMAT; "paste brief" fills the capture; "copy brief prompt" on the row sends
-- the chat to audit the code; THE AUDIT and THE PLAN paste back; "scope it".
--
-- The capture asks only what Alex knows (ruling A). One fact, one home
-- (ruling B): problem = 1 WHAT IS WRONG TODAY, why = 2 WHY IT MATTERS, goal =
-- 3 THE ONE CORRECT OUTCOME, diagnosis = THE AUDIT pasted back, design = THE
-- PLAN pasted back, definition_of_done = PROOF OF DONE — all existing columns.
-- Three the capture asks that had no home:
--   "rulings"          TEXT          4 ALREADY RULED — one per line; nothing
--                                    here gets re-decided
--   "open_questions"   TEXT          5 WANT A RECOMMENDATION ON — one per line
--   "deadline_reason"  VARCHAR(500)  6 BY WHEN, AND WHY — the reason for the
--                                    target date; REQUIRED by the rule when a
--                                    target date is set, a line (500 is the
--                                    column's length, counted in code points
--                                    by the rule)
--
-- NULL is unanswered, as every capture text: no default, never "". Columns
-- only — no enum, no row written. The three *_items JSONB columns are no
-- longer written or shown by the UI from this ruling (data untouched; CLEAN-03
-- rules on dropping).
--
-- Additive only — safe on `prisma migrate deploy`, no backfill; applied at
-- deploy after merge (package.json "build"), never by hand from a session.

ALTER TABLE "operations_projects"
  ADD COLUMN "rulings" TEXT,
  ADD COLUMN "open_questions" TEXT,
  ADD COLUMN "deadline_reason" VARCHAR(500);
