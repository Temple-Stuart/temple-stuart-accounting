-- =================================================================
-- PR-E: AI Discovery Engine — profile, runs, proposals
-- =================================================================

-- STEP 1: Create enums
CREATE TYPE "RevenueStage" AS ENUM ('pre_revenue', 'pre_charging', 'charging_under_50k', 'charging_50k_500k', 'charging_500k_5m', 'charging_over_5m');
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('initiated', 'profile_validation', 'source_selection', 'web_search_running', 'synthesis_running', 'citation_verification', 'completed', 'failed', 'cancelled');
CREATE TYPE "ProposalStatus" AS ENUM ('proposed', 'accepted', 'rejected', 'modified_then_accepted', 'superseded');
CREATE TYPE "ProposalType" AS ENUM ('mission', 'project', 'workstream', 'task');

-- STEP 2: Create user_profiles table
CREATE TABLE "user_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "business_description" TEXT NOT NULL,
    "primary_entity_id" UUID,
    "operating_jurisdictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "customer_jurisdictions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "products_services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ai_use_in_product" BOOLEAN NOT NULL DEFAULT false,
    "ai_use_description" TEXT,
    "handles_personal_data" BOOLEAN NOT NULL DEFAULT false,
    "handles_financial_data" BOOLEAN NOT NULL DEFAULT false,
    "handles_health_data" BOOLEAN NOT NULL DEFAULT false,
    "revenue_stage" "RevenueStage" NOT NULL,
    "employee_count" INTEGER NOT NULL DEFAULT 1,
    "planned_actions_24mo" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "known_completed_filings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_profiles_user_id_key" ON "user_profiles"("user_id");
CREATE INDEX "user_profiles_user_id_idx" ON "user_profiles"("user_id");

ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 3: Create discovery_runs table
CREATE TABLE "discovery_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "user_profile_id" UUID NOT NULL,
    "user_profile_snapshot" JSONB NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'initiated',
    "status_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "anthropic_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "anthropic_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "anthropic_cache_read_tokens" INTEGER NOT NULL DEFAULT 0,
    "web_searches_run" INTEGER NOT NULL DEFAULT 0,
    "estimated_cost_usd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "sources_queried_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model_used" VARCHAR(100) NOT NULL,
    "prompt_version" VARCHAR(20) NOT NULL,
    "proposals_generated_count" INTEGER NOT NULL DEFAULT 0,
    "citations_generated_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_runs_user_id_started_at_idx" ON "discovery_runs"("user_id", "started_at");
CREATE INDEX "discovery_runs_status_idx" ON "discovery_runs"("status");

ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discovery_runs" ADD CONSTRAINT "discovery_runs_user_profile_id_fkey"
    FOREIGN KEY ("user_profile_id") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- STEP 4: Create discovery_proposals table
CREATE TABLE "discovery_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "discovery_run_id" UUID NOT NULL,
    "proposal_type" "ProposalType" NOT NULL,
    "parent_proposal_id" UUID,
    "proposed_payload" JSONB NOT NULL,
    "proposed_citation_payloads" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "ai_rationale" TEXT NOT NULL,
    "ai_priority_score" DECIMAL(5,2),
    "ai_confidence" DECIMAL(5,2),
    "status" "ProposalStatus" NOT NULL DEFAULT 'proposed',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" VARCHAR(255),
    "review_notes" TEXT,
    "user_modifications" JSONB,
    "materialized_to_table" VARCHAR(100),
    "materialized_to_id" VARCHAR(255),
    "materialized_at" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discovery_proposals_discovery_run_id_status_idx" ON "discovery_proposals"("discovery_run_id", "status");
CREATE INDEX "discovery_proposals_proposal_type_status_idx" ON "discovery_proposals"("proposal_type", "status");
CREATE INDEX "discovery_proposals_parent_proposal_id_idx" ON "discovery_proposals"("parent_proposal_id");

ALTER TABLE "discovery_proposals" ADD CONSTRAINT "discovery_proposals_discovery_run_id_fkey"
    FOREIGN KEY ("discovery_run_id") REFERENCES "discovery_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "discovery_proposals" ADD CONSTRAINT "discovery_proposals_parent_proposal_id_fkey"
    FOREIGN KEY ("parent_proposal_id") REFERENCES "discovery_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- STEP 5: CHECK constraints
ALTER TABLE "user_profiles" ADD CONSTRAINT user_profiles_employee_count_valid
    CHECK ("employee_count" >= 1);

ALTER TABLE "discovery_runs" ADD CONSTRAINT discovery_runs_token_counts_valid
    CHECK ("anthropic_input_tokens" >= 0
        AND "anthropic_output_tokens" >= 0
        AND "anthropic_cache_read_tokens" >= 0);

ALTER TABLE "discovery_runs" ADD CONSTRAINT discovery_runs_cost_valid
    CHECK ("estimated_cost_usd" >= 0);

ALTER TABLE "discovery_proposals" ADD CONSTRAINT discovery_proposals_priority_valid
    CHECK ("ai_priority_score" IS NULL OR ("ai_priority_score" >= 0 AND "ai_priority_score" <= 100));

ALTER TABLE "discovery_proposals" ADD CONSTRAINT discovery_proposals_confidence_valid
    CHECK ("ai_confidence" IS NULL OR ("ai_confidence" >= 0 AND "ai_confidence" <= 1));
