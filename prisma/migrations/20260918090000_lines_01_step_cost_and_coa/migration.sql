-- LINES-01 — A ROUTINE IS MADE OF LINES, AND EACH LINE CARRIES ITS OWN COST AND
-- CATEGORY.
--
-- A step already holds time and place. It now holds the rest of the triple —
-- cost and category — so a morning routine can be a gym line with no amount, a
-- coffee line at $80 / 5200 and a dining-out line at $200 with no category.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; Alex runs this
-- via psql, or it applies at deploy after merge.

-- STEP 1: the line carries the triple. Both NULLABLE. Blank is blank — no
-- DEFAULT 0, which would turn every existing uncosted line into a $0 line and
-- put a number on the day that nobody set.
ALTER TABLE "operations_routine_steps" ADD COLUMN "budget_amount" DECIMAL(12,2);
ALTER TABLE "operations_routine_steps" ADD COLUMN "coa_code"      VARCHAR(50);

-- STEP 2: NOTHING IS IMPUTED. The routine-level budget_amount is NOT copied down
-- onto its lines, and it is NOT dropped. A stepless routine still needs it, and
-- a lined routine keeps it as a figure the rule REPORTS as ignored. Every existing
-- routine's planned figure is therefore unchanged by this migration: no line has
-- an amount yet, so the rule (src/lib/operations/routineLines.ts) falls through
-- to the routine-level field for every one of them. A test proves it on a
-- fixture of both shapes.

-- STEP 3: the link moves to the line. A posting links to the LINE it settled —
-- the coffee posting to the coffee line — on kind 'routine_line', keyed on
-- (step_id, the occurrence instant). The same CHECK discipline LINK-01 set: the
-- instant is MANDATORY for a routine occurrence, whether addressed by routine or
-- by line, and FORBIDDEN for anything else.
ALTER TABLE "planned_item_links" DROP CONSTRAINT "planned_item_links_kind";
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_kind"
  CHECK ("target_kind" IN ('calendar_event', 'project_task', 'routine', 'routine_line'));

ALTER TABLE "planned_item_links" DROP CONSTRAINT "planned_item_links_instant_iff_routine";
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_instant_iff_routine"
  CHECK (("target_kind" IN ('routine', 'routine_line')) = ("target_instant" IS NOT NULL));

-- STEP 4: NO LINK IS MIGRATED. An existing 'routine' link on a routine that has
-- steps is NOT moved to a line — this migration cannot know which line it
-- belongs to, and guessing would be the thing LINK-01 exists to refuse. The
-- 'routine' kind stays for stepless routines and is never repurposed. Alex's
-- query (the PR body, STEP 0.3) lists any such links; they are his call.
