-- =============================================================================
-- PR-K: Embedding runs table + AuditActionType extensions
-- =============================================================================
-- Adds audit-grade cost tracking for the Voyage AI embedding worker
-- (architecture doc § 8.1 PR-10, brought forward in our build sequence).
--
-- Two parts:
--   1. embedding_runs table: per-run record with model, chunks/tokens
--      counts, USD cost, outcome, cost_cap. This is the seed for PR-23's
--      generalized cost_ledger; PR-23 will extend this pattern across
--      Anthropic, OpenAI, and other providers.
--   2. AuditActionType enum extensions:
--      - regulatory_chunks_embedded: emitted per successful batch
--      - embedding_run_completed: emitted at run summary
--      - embedding_run_cost_capped: emitted when cost cap hits
--
-- ALTER TYPE ADD VALUE intentionally not wrapped in BEGIN/COMMIT per
-- the PR-G convention (Postgres driver edge cases on enum-extension
-- inside explicit transactions).
-- =============================================================================

-- PART 1: embedding_runs table
BEGIN;

CREATE TABLE IF NOT EXISTS embedding_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL,
    completed_at timestamptz,
    model_name text NOT NULL,
    chunks_embedded integer NOT NULL DEFAULT 0,
    tokens_total integer NOT NULL DEFAULT 0,
    cost_usd numeric(10,4) NOT NULL DEFAULT 0,
    cost_cap_usd numeric(10,4) NOT NULL,
    outcome text NOT NULL,
    error_message text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT embedding_runs_outcome_check
        CHECK (outcome IN ('completed', 'failed', 'cost_capped', 'in_progress'))
);

CREATE INDEX IF NOT EXISTS embedding_runs_started_at_idx
    ON embedding_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS embedding_runs_outcome_idx
    ON embedding_runs (outcome);

COMMENT ON TABLE embedding_runs IS
    'Audit-grade per-run record of embedding worker invocations. Tracks '
    'model, chunks/tokens counts, USD cost, outcome. Seed for PR-23 cost_ledger.';

COMMENT ON COLUMN embedding_runs.outcome IS
    'completed: ran to end, all chunks embedded. '
    'failed: errored before completion. '
    'cost_capped: stopped because cost_cap_usd reached. '
    'in_progress: row created at run start, updated on completion.';

COMMIT;

-- PART 2: AuditActionType extensions
-- IF NOT EXISTS guards make this idempotent.
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'regulatory_chunks_embedded';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'embedding_run_completed';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'embedding_run_cost_capped';
