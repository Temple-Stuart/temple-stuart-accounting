-- PR-Ops-3.8: Task link_url + notes columns
--
-- Adds link_url and notes columns to operations_project_tasks. These
-- are populated by AI-generated tasks (PR-Ops-3.8 web-search synthesis)
-- and manually by users via the task edit modal.
--
-- link_url: verified vendor URL for the task (e.g., FAFSA login page,
--   Sallie Mae dashboard, Cal State LA registrar contact form). AI
--   uses Anthropic's web_search_20250305 tool to verify URLs at
--   generation time.
--
-- notes: institutional context for the task — dependencies, timing
--   anchors, decision points, gotchas. This is where the per-task
--   reasoning that previously lived in prose design plans now lives.
--   Max 1500 chars enforced server-side.
--
-- Existing unblocks_label column is kept (PR-Ops-3b priority engine
-- signal — "what does completing this unblock"). It is semantically
-- distinct from generic notes: unblocks_label feeds the priority
-- engine, notes feeds the operator. Consolidate in a future PR if
-- the distinction proves unused.

ALTER TABLE "operations_project_tasks"
    ADD COLUMN "link_url" TEXT,
    ADD COLUMN "notes" TEXT;
