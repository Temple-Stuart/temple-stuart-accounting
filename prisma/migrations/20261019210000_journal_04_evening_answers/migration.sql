-- JOURNAL-04 (Alex, 2026-10-19) — THE EVENING'S THREE ANSWERS: audit · learned · next.
--
-- The journal becomes two cards on the day card: MORNING — planning (today's
-- goals, blockers, the plan with ticks: the four answers that exist) and
-- EVENING — reflection. This migration is the evening's DATA; JOURNAL-05 builds
-- the two cards. Three nullable columns on the one row per (user, day):
--   "audit"    TEXT          where did we actually get to — the audit Claude
--                            writes from the plan, the ticks and the day's
--                            records, pasted back; paragraphs
--   "learned"  VARCHAR(500)  what did I learn, or what surprised me
--   "next"     VARCHAR(500)  where do I want to take it next — the line
--                            tomorrow's morning card shows first and the
--                            reel's cliffhanger (REEL-02)
--
-- NULL is unanswered, as JOURNAL-01 holds for every text: no default, never "".
--
-- HELD HERE: no blank answer (a blank is unanswered — NULL — never a string of
-- whitespace; the evening's not-blank CHECK); and at least one answer — the
-- at-least-one CHECK is re-made as JOURNAL-02's expression OR one of the three,
-- so a row of an evening alone is a journal (Alex, decision 7) and every row
-- typed before still satisfies it; it is dropped and re-added in ONE statement.
-- HELD BY THE RULE (src/lib/operations/journal.ts journalInput), refused there
-- by name: learned's and next's 500 CHARACTERS are their columns' lengths,
-- counted in code points; audit's cap of 4000 code points and 200 lines is the
-- rule's own on a TEXT column, which the database does not bound; the line
-- breaks of audit are kept (a block, never flattened), its blank-line runs
-- collapsed to one.
--
-- "next" is quoted everywhere it appears here: a keyword in some dialects —
-- Postgres allows it, and quoted it cannot be misread.
--
-- No DROP COLUMN, no enum value (operations_journal_set and _cleared cover the
-- writes), no data statement. AUTHORED here, applied at deploy (package.json
-- build runs prisma migrate deploy before next build). NO BACKFILL, no row
-- written: the three columns are NULL on every existing row, which every
-- CHECK below allows.

ALTER TABLE "operations_day_journals"
  ADD COLUMN "audit"   TEXT,
  ADD COLUMN "learned" VARCHAR(500),
  ADD COLUMN "next"    VARCHAR(500);

ALTER TABLE "operations_day_journals"
  ADD CONSTRAINT "operations_day_journals_evening_not_blank" CHECK (
    ("audit" IS NULL OR length(btrim("audit")) > 0)
    AND ("learned" IS NULL OR length(btrim("learned")) > 0)
    AND ("next" IS NULL OR length(btrim("next")) > 0)
  );

ALTER TABLE "operations_day_journals"
  DROP CONSTRAINT "operations_day_journals_at_least_one",
  ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK (
    num_nonnulls("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped") >= 1
    OR cardinality("goals") > 0
    OR cardinality("plan_steps") > 0
    OR num_nonnulls("audit", "learned", "next") >= 1
  );
