-- =================================================================
-- PR-A: Drop legacy/orphan tables, create regulatory_sources
-- =================================================================
-- Pre-deletion archive: Alex must run scripts/pre-pra-export.sh
-- BEFORE applying this migration.
-- Production row counts at archival: missions=1, mission_stages=5,
-- brain_dump_entries=28, reality_constraints=0, roadmap_weeks=0,
-- mission_tasks=0, daily_plans_with_mission=0

-- STEP 1: Remove daily_plans FK to legacy_missions (0 linked rows)
ALTER TABLE "daily_plans" DROP CONSTRAINT IF EXISTS "daily_plans_mission_id_fkey";

-- STEP 2: Drop FK-dependent children FIRST
DROP TABLE IF EXISTS "task_evidence_urls" CASCADE;
DROP TABLE IF EXISTS "task_evidence_code" CASCADE;
DROP TABLE IF EXISTS "task_evidence_documents" CASCADE;
DROP TABLE IF EXISTS "task_evidence" CASCADE;

-- STEP 3: Drop ops/compliance tables
DROP TABLE IF EXISTS "compliance_tasks" CASCADE;
DROP TABLE IF EXISTS "ops_synthesis_report" CASCADE;
DROP TABLE IF EXISTS "ops_workstream_analysis" CASCADE;
DROP TABLE IF EXISTS "ops_questionnaire_answers" CASCADE;

-- STEP 4: Drop legacy mission tables (children before parents)
DROP TABLE IF EXISTS "legacy_mission_tasks" CASCADE;
DROP TABLE IF EXISTS "legacy_roadmap_weeks" CASCADE;
DROP TABLE IF EXISTS "legacy_reality_constraints" CASCADE;
DROP TABLE IF EXISTS "legacy_brain_dump_entries" CASCADE;
DROP TABLE IF EXISTS "legacy_mission_stages" CASCADE;
DROP TABLE IF EXISTS "legacy_missions" CASCADE;

-- STEP 5: Drop obsolete enums
DROP TYPE IF EXISTS "MissionStatus" CASCADE;
DROP TYPE IF EXISTS "StageType" CASCADE;
DROP TYPE IF EXISTS "StageStatus" CASCADE;
DROP TYPE IF EXISTS "BrainDumpBucket" CASCADE;
DROP TYPE IF EXISTS "EntrySource" CASCADE;
DROP TYPE IF EXISTS "ConstraintType" CASCADE;
DROP TYPE IF EXISTS "WeekStatus" CASCADE;
DROP TYPE IF EXISTS "MissionTaskStatus" CASCADE;

-- STEP 6: Create new enums
CREATE TYPE "SourceTier" AS ENUM ('primary_law', 'subregulatory_guidance', 'agency_enforcement', 'secondary_authoritative', 'secondary_practitioner');
CREATE TYPE "RefreshCadence" AS ENUM ('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'event_driven');
CREATE TYPE "PracticeArea" AS ENUM ('tax_federal', 'tax_state', 'bookkeeping_accounting', 'financial_reporting', 'data_privacy_us_federal', 'data_privacy_us_state', 'data_privacy_eu', 'data_security', 'financial_data_glba', 'tax_preparer_regulation', 'investment_adviser', 'broker_dealer', 'securities_disclosure', 'options_market_data', 'ai_governance_eu', 'ai_governance_us', 'consumer_protection_ftc', 'consumer_protection_state', 'travel_consumer_protection', 'aviation_dot', 'accessibility_ada', 'payment_processing', 'sales_tax_nexus', 'corporate_governance', 'employment_solo', 'intellectual_property', 'terms_of_service_law', 'cybersecurity_breach_notification', 'anti_money_laundering', 'international_trade_sanctions');

-- STEP 7: Create regulatory_sources table
CREATE TABLE "regulatory_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "domain" VARCHAR(255) NOT NULL,
    "source_name" VARCHAR(255) NOT NULL,
    "source_tier" "SourceTier" NOT NULL,
    "authority_rank" SMALLINT NOT NULL,
    "jurisdictions" TEXT[] NOT NULL,
    "regulators" TEXT[] NOT NULL,
    "practice_areas" "PracticeArea"[] NOT NULL,
    "module_relevance" TEXT[] NOT NULL,
    "primary_content_types" TEXT[] NOT NULL,
    "refresh_cadence" "RefreshCadence" NOT NULL,
    "currency_verification_method" TEXT,
    "api_or_bulk_data" TEXT,
    "notes" TEXT,
    "last_verified" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_verified_by" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regulatory_sources_pkey" PRIMARY KEY ("id")
);

-- STEP 8: Create indexes
CREATE UNIQUE INDEX "regulatory_sources_domain_key" ON "regulatory_sources"("domain");
CREATE INDEX "regulatory_sources_source_tier_authority_rank_idx" ON "regulatory_sources"("source_tier", "authority_rank");
CREATE INDEX "regulatory_sources_is_active_idx" ON "regulatory_sources"("is_active");

-- STEP 9: Add CHECK constraint on authority_rank
ALTER TABLE "regulatory_sources" ADD CONSTRAINT
  regulatory_sources_authority_rank_check
  CHECK (authority_rank >= 1 AND authority_rank <= 5);
