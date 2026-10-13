-- JOURNAL-01 (2026-10-13) — THE DAY'S JOURNAL: the morning's answers, one row per day.
--
-- The journal routine's stop on the day card (a routine whose role is 'journal',
-- ROLE-01) shows a plate of three blocks — YESTERDAY, TODAY, PLAN — and asks the
-- questions under it. This table holds THE ANSWERS a person typed for one day:
-- the adjustment ("→ so today"), the one thing, the witness, the blocker, what
-- shipped, up to three "if … then …" pairs and the obstacle's "if … → then …".
--
-- WHY THE NUMBERS ARE NOT COLUMNS. The plate's figures — yesterday's spent against
-- its plan, the largest delta, done of N, what shipped — are DERIVED at read time
-- from yesterday's own reads (the today read, the Budget's plan lines, the stop
-- records, the daily plan) and never stored: a stored copy would drift from the
-- sources the moment a record or a plan line changed, and the card would show two
-- truths. Only the words a person typed live here.
--
-- HELD HERE, NOT BY CONVENTION (STEP 1): one journal per (user, day) — UNIQUE;
-- an "if" and its "then" both or neither (four pair CHECKs); no answer is blank
-- (a blank is unanswered — NULL — never ""); and at least one answer (the nine
-- independent answers counted, each "_if" standing for its pair) — an empty
-- journal is no row. updated_at is written by Prisma's @updatedAt (no DB default)
-- and read back as the "typed" instant; the PUT route guards its write on it.
--
-- onDelete: a deleted user's journals go with them (CASCADE).
--
-- The two AuditActionType values name a set (created or changed) and a clear
-- (STEP 2), added the STOP-01 way. A new enum value cannot be USED in the
-- transaction that added it; nothing here uses them.
--
-- AUTHORED here, applied at deploy (package.json:11 runs prisma migrate deploy
-- before next build). NO BACKFILL: no journal existed before this table.

-- STEP 1 — the table.
CREATE TABLE "operations_day_journals" (
  "id"            UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       TEXT           NOT NULL,
  "day"           DATE           NOT NULL,
  "adjustment"    VARCHAR(280),
  "one_thing"     VARCHAR(120),
  "plan_1_if"     VARCHAR(160),
  "plan_1_then"   VARCHAR(160),
  "plan_2_if"     VARCHAR(160),
  "plan_2_then"   VARCHAR(160),
  "plan_3_if"     VARCHAR(160),
  "plan_3_then"   VARCHAR(160),
  "obstacle_if"   VARCHAR(160),
  "obstacle_then" VARCHAR(160),
  "blocker"       VARCHAR(280),
  "witness"       VARCHAR(120),
  "shipped"       VARCHAR(500),
  "created_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operations_day_journals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operations_day_journals_one_per_day" UNIQUE ("user_id", "day"),
  CONSTRAINT "operations_day_journals_plan_1_pair" CHECK (("plan_1_if" IS NULL) = ("plan_1_then" IS NULL)),
  CONSTRAINT "operations_day_journals_plan_2_pair" CHECK (("plan_2_if" IS NULL) = ("plan_2_then" IS NULL)),
  CONSTRAINT "operations_day_journals_plan_3_pair" CHECK (("plan_3_if" IS NULL) = ("plan_3_then" IS NULL)),
  CONSTRAINT "operations_day_journals_obstacle_pair" CHECK (("obstacle_if" IS NULL) = ("obstacle_then" IS NULL)),
  CONSTRAINT "operations_day_journals_answers_not_blank" CHECK (
    ("adjustment" IS NULL OR length(btrim("adjustment")) > 0)
    AND ("one_thing" IS NULL OR length(btrim("one_thing")) > 0)
    AND ("plan_1_if" IS NULL OR length(btrim("plan_1_if")) > 0)
    AND ("plan_1_then" IS NULL OR length(btrim("plan_1_then")) > 0)
    AND ("plan_2_if" IS NULL OR length(btrim("plan_2_if")) > 0)
    AND ("plan_2_then" IS NULL OR length(btrim("plan_2_then")) > 0)
    AND ("plan_3_if" IS NULL OR length(btrim("plan_3_if")) > 0)
    AND ("plan_3_then" IS NULL OR length(btrim("plan_3_then")) > 0)
    AND ("obstacle_if" IS NULL OR length(btrim("obstacle_if")) > 0)
    AND ("obstacle_then" IS NULL OR length(btrim("obstacle_then")) > 0)
    AND ("blocker" IS NULL OR length(btrim("blocker")) > 0)
    AND ("witness" IS NULL OR length(btrim("witness")) > 0)
    AND ("shipped" IS NULL OR length(btrim("shipped")) > 0)
  ),
  CONSTRAINT "operations_day_journals_at_least_one" CHECK (
    num_nonnulls("adjustment", "one_thing", "plan_1_if", "plan_2_if", "plan_3_if", "obstacle_if", "blocker", "witness", "shipped") >= 1
  )
);

ALTER TABLE "operations_day_journals"
  ADD CONSTRAINT "operations_day_journals_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 2 — the audit vocabulary.
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_journal_set';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_journal_cleared';
