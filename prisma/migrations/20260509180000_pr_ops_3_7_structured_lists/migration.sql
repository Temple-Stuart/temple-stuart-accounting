-- PR-Ops-3.7: Structured Lists Refactor
--
-- Replaces paragraph-style goal/problem/diagnosis with JSONB array
-- columns (goal_items / problem_items / diagnosis_items). Each item is
-- one natural-voice line ("I WANT to ...", "I DID NOT ...", "I HAVE NOT
-- ...", "I NEED TO ..."). Verb prefix is stored verbatim per architectural
-- decision (B): WYSIWYG, no hidden UI prefix layer.
--
-- Legacy columns (goal, problem, diagnosis, design) become nullable but
-- remain in the schema. Reasoning: audit_log payload_before history
-- references the old paragraph values; dropping would break audit replay.
-- Future PR drops them once audit replay is no longer a concern.
--
-- The user has confirmed clean-slate state (5 prior projects deleted via
-- UI before this PR shipped). No data migration needed; new projects
-- start with empty array defaults.
--
-- Design column stays as before — AI populates it via the existing
-- generate-design endpoint. Future variant could decompose design into
-- structured "steps" array for richer rendering, but v0 keeps it as text.

ALTER TABLE "operations_projects"
    ADD COLUMN "goal_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "problem_items" JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN "diagnosis_items" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "operations_projects"
    ALTER COLUMN "goal" DROP NOT NULL,
    ALTER COLUMN "problem" DROP NOT NULL,
    ALTER COLUMN "diagnosis" DROP NOT NULL,
    ALTER COLUMN "design" DROP NOT NULL;

-- Drop the existing CHECK constraints that enforce non-empty trim.
-- (PR-Ops-1 created these as content_non_empty checks. They reference
--  the now-nullable columns. Re-create simpler nullable-OR-non-empty
--  versions if needed; for v0 we drop them entirely since the new
--  array columns enforce content via server-side validation.)
--
-- Use IF EXISTS so this is idempotent if constraints were named
-- differently in the original migration.

DO $$
BEGIN
    EXECUTE 'ALTER TABLE "operations_projects" DROP CONSTRAINT IF EXISTS "operations_projects_goal_check"';
    EXECUTE 'ALTER TABLE "operations_projects" DROP CONSTRAINT IF EXISTS "operations_projects_problem_check"';
    EXECUTE 'ALTER TABLE "operations_projects" DROP CONSTRAINT IF EXISTS "operations_projects_diagnosis_check"';
    EXECUTE 'ALTER TABLE "operations_projects" DROP CONSTRAINT IF EXISTS "operations_projects_design_check"';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'CHECK constraint cleanup encountered % — proceeding', SQLERRM;
END $$;
