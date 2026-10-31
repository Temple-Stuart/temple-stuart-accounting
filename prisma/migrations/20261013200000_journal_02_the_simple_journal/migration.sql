-- JOURNAL-02 (2026-10-13) — THE SIMPLE JOURNAL: yesterday · today's goals · blockers · the plan with ticks · end of day.
--
-- The journal becomes five things, in this order on the plate and in the form:
--   YESTERDAY   read-only, derived from yesterday's row and reads   (no column)
--   TODAY       the day's goals, a list                             NEW "goals" TEXT[]
--   BLOCKERS    what could stop it                                  "blocker" (JOURNAL-01's)
--   PLAN        numbered steps, each tickable                       NEW "plan_steps" TEXT[] + "plan_done" BOOLEAN[]
--   END OF DAY  what got done, typed tonight                        "shipped" (JOURNAL-01's, relabelled)
--
-- RETIRED 2026-10-13 (JOURNAL-02): "adjustment", "one_thing", "witness",
-- "plan_1_if", "plan_1_then", "plan_2_if", "plan_2_then", "plan_3_if",
-- "plan_3_then", "obstacle_if", "obstacle_then" — not asked, not shown and not
-- written from now on. KEPT in the table: no DROP COLUMN — a drop is
-- irreversible, and the rows typed today keep their words. Their JOURNAL-01
-- CHECKs (the four pairs, not blank) stand and still hold.
--
-- HELD HERE: at most 8 goals and 12 steps; one tick per step (the two lengths
-- equal); no NULL element in any of the three lists. The at-least-one CHECK is
-- re-made as the old nine answers OR a goal OR a step, so a row typed under
-- JOURNAL-01 (retired answers only) still holds and a row of goals alone is a
-- journal; it is dropped and re-added in ONE statement. Each goal's and step's
-- length and a blank element are the rule's (src/lib/operations/journal.ts
-- journalInput), refused there by name.
--
-- AUTHORED here, applied at deploy (package.json:11 runs prisma migrate deploy
-- before next build). NO BACKFILL, no row written: the three lists default to
-- empty, which every existing row satisfies.

ALTER TABLE "operations_day_journals"
  ADD COLUMN "goals"      TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN "plan_steps" TEXT[]    NOT NULL DEFAULT '{}',
  ADD COLUMN "plan_done"  BOOLEAN[] NOT NULL DEFAULT '{}';

ALTER TABLE "operations_day_journals"
  ADD CONSTRAINT "operations_day_journals_goals_at_most_8" CHECK (cardinality("goals") <= 8),
  ADD CONSTRAINT "operations_day_journals_plan_steps_at_most_12" CHECK (cardinality("plan_steps") <= 12),
  ADD CONSTRAINT "operations_day_journals_one_tick_per_step" CHECK (cardinality("plan_steps") = cardinality("plan_done")),
  ADD CONSTRAINT "operations_day_journals_lists_no_null" CHECK (
    array_position("goals", NULL) IS NULL
    AND array_position("plan_steps", NULL) IS NULL
    AND array_position("plan_done", NULL) IS NULL
  );

ALTER TABLE "operations_day_journals"
  DROP CONSTRAINT "operations_day_journals_at_least_one",
  ADD CONSTRAINT "operations_day_journals_at_least_one" CHECK (
    num_nonnulls("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped") >= 1
    OR cardinality("goals") > 0
    OR cardinality("plan_steps") > 0
  );
