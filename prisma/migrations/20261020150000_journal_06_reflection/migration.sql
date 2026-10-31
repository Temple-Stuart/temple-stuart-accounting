-- JOURNAL-06 (Alex, 2026-10-20) — THE EVENING'S SIX QUESTIONS AND THE REFLECTION PROMPT.
--
-- Alex, 15:27: the evening card is "the same prompt every day" that "audits the
-- work from sitting down to finishing; articulate changes in direction and
-- why, verify they make sense, add them to the projects". The card asks SEVEN
-- things, in order: ACCOMPLISHED (the narrative pasted back from the chat —
-- the existing "audit" column, one home) · GAPS · EVOLUTION · DIRECTION ·
-- ALIGNMENT · ON TRACK · NEXT (the existing column, unchanged — the morning's
-- "Last night:" line and the reel's "Tomorrow:" read it). Five new columns,
-- each the audit's rule (journal.ts blockOf: line breaks kept, at most 4000
-- code points and 200 lines — a TEXT column the database does not bound):
--   "gaps"       TEXT  what gaps do you see — what is missing, wrong, or not yet true
--   "evolution"  TEXT  what changed in how we build today
--   "direction"  TEXT  going well, or change direction? which, and why
--   "alignment"  TEXT  is the chat doing anything not aligned with your vision
--   "on_track"   TEXT  on the rails — accounting rules, SOC 2, the mission?
--
-- "learned" RETIRES (JOURNAL-03's way): its column STAYS, nullable, never
-- written again — it leaves ANSWER_FIELDS for RETIRED_FIELDS, and a body that
-- carries it is refused by name. No DROP COLUMN.
--
-- NULL is unanswered, as JOURNAL-04 holds for every text: no default, never "".
--
-- HELD HERE: no blank answer — the evening's not-blank CHECK is DROPPED and
-- re-ADDED in ONE statement covering audit, learned, next and the five; and at
-- least one answer — the at-least-one CHECK is DROPPED and re-ADDED in ONE
-- statement, its last clause counting the eight evening columns, so a row of an
-- evening alone is still a journal and every row typed before still satisfies
-- it. HELD BY THE RULE (src/lib/operations/journal.ts journalInput), refused
-- there by name: the five's 4000 code points and 200 lines (blockOf).
--
-- "next" is quoted everywhere it appears here: a keyword in some dialects —
-- Postgres allows it, and quoted it cannot be misread.
--
-- Additive only — NO BACKFILL, no row written, no enum value; safe on
-- `prisma migrate deploy`; applied at deploy after merge (package.json
-- "build"), never by hand from a session.

ALTER TABLE "operations_day_journals"
  ADD COLUMN "gaps"      TEXT,
  ADD COLUMN "evolution" TEXT,
  ADD COLUMN "direction" TEXT,
  ADD COLUMN "alignment" TEXT,
  ADD COLUMN "on_track"  TEXT;

ALTER TABLE "operations_day_journals"
  DROP CONSTRAINT "operations_day_journals_evening_not_blank",
  ADD CONSTRAINT "operations_day_journals_evening_not_blank" CHECK (
    ("audit" IS NULL OR length(btrim("audit")) > 0)
    AND ("learned" IS NULL OR length(btrim("learned")) > 0)
    AND ("next" IS NULL OR length(btrim("next")) > 0)
    AND ("gaps" IS NULL OR length(btrim("gaps")) > 0)
    AND ("evolution" IS NULL OR length(btrim("evolution")) > 0)
    AND ("direction" IS NULL OR length(btrim("direction")) > 0)
    AND ("alignment" IS NULL OR length(btrim("alignment")) > 0)
    AND ("on_track" IS NULL OR length(btrim("on_track")) > 0)
  );

ALTER TABLE "operations_day_journals"
  DROP CONSTRAINT "operations_day_journals_at_least_one",
  ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK (
    num_nonnulls("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped") >= 1
    OR cardinality("goals") > 0
    OR cardinality("plan_steps") > 0
    OR num_nonnulls("audit", "learned", "next", "gaps", "evolution", "direction", "alignment", "on_track") >= 1
  );
