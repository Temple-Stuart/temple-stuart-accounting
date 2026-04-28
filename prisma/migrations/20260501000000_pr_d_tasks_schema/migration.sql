-- =================================================================
-- PR-D: Missions, Projects, Workstreams, Compliance Tasks
-- Institutional schema with RACI, FAIR risk, lifecycle clocks
-- =================================================================

-- STEP 1: Create enums
CREATE TYPE "MissionStatus" AS ENUM ('draft', 'active', 'paused', 'blocked', 'completed', 'cancelled', 'archived');
CREATE TYPE "ProjectStatus" AS ENUM ('not_started', 'in_progress', 'blocked', 'completed', 'cancelled', 'archived');
CREATE TYPE "WorkstreamStatus" AS ENUM ('not_started', 'in_progress', 'blocked', 'completed', 'not_applicable');
CREATE TYPE "TaskStatus" AS ENUM ('proposed', 'scoped', 'scheduled', 'in_progress', 'blocked', 'awaiting_evidence', 'awaiting_attestation', 'completed', 'superseded', 'cancelled');
CREATE TYPE "TaskPriorityTier" AS ENUM ('required_now', 'before_charging_users', 'at_scale', 'best_practice');
CREATE TYPE "DueDateBasis" AS ENUM ('regulatory_deadline', 'internal_target', 'risk_based', 'vendor_sla', 'not_applicable');
CREATE TYPE "MonitoringFrequency" AS ENUM ('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'event_driven', 'not_applicable');
CREATE TYPE "AttestationFrequency" AS ENUM ('per_change', 'monthly', 'quarterly', 'semi_annual', 'annual', 'biennial', 'not_applicable');
CREATE TYPE "ResidualRiskLevel" AS ENUM ('very_low', 'low', 'moderate', 'high', 'very_high');
CREATE TYPE "AttestationStatus" AS ENUM ('not_required', 'pending', 'attested', 'expired', 'revoked');

-- STEP 2: Create missions table
CREATE TABLE "missions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "entity_id" TEXT,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "status" "MissionStatus" NOT NULL DEFAULT 'draft',
    "target_completion" TIMESTAMP(3),
    "actual_completion" TIMESTAMP(3),
    "framework_mappings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "missions_user_id_status_idx" ON "missions"("user_id", "status");
CREATE INDEX "missions_entity_id_idx" ON "missions"("entity_id");
CREATE INDEX "missions_is_active_idx" ON "missions"("is_active");

ALTER TABLE "missions" ADD CONSTRAINT "missions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 3: Create projects table
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mission_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "domain_label" VARCHAR(255) NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'not_started',
    "target_completion" TIMESTAMP(3),
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_mission_id_status_idx" ON "projects"("mission_id", "status");
CREATE INDEX "projects_is_active_idx" ON "projects"("is_active");

ALTER TABLE "projects" ADD CONSTRAINT "projects_mission_id_fkey"
    FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 4: Create workstreams table
CREATE TABLE "workstreams" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "status" "WorkstreamStatus" NOT NULL DEFAULT 'not_started',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workstreams_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workstreams_project_id_status_idx" ON "workstreams"("project_id", "status");
CREATE INDEX "workstreams_is_active_idx" ON "workstreams"("is_active");

ALTER TABLE "workstreams" ADD CONSTRAINT "workstreams_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- STEP 5: Create compliance_tasks table
CREATE TABLE "compliance_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workstream_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'proposed',
    "priority_tier" "TaskPriorityTier" NOT NULL,
    "priority_rationale" TEXT,
    "inherent_likelihood" "ResidualRiskLevel" NOT NULL,
    "inherent_impact" "ResidualRiskLevel" NOT NULL,
    "residual_likelihood" "ResidualRiskLevel",
    "residual_impact" "ResidualRiskLevel",
    "penalty_min_amount" DECIMAL(15,2),
    "penalty_max_amount" DECIMAL(15,2),
    "penalty_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "penalty_description" TEXT,
    "penalty_weight" INTEGER NOT NULL DEFAULT 0,
    "estimated_effort_hours_min" DECIMAL(6,2),
    "estimated_effort_hours_max" DECIMAL(6,2),
    "estimated_cost_min" DECIMAL(15,2),
    "estimated_cost_max" DECIMAL(15,2),
    "due_date" TIMESTAMP(3),
    "due_date_basis" "DueDateBasis" NOT NULL DEFAULT 'not_applicable',
    "due_date_rationale" TEXT,
    "monitoring_frequency" "MonitoringFrequency" NOT NULL DEFAULT 'not_applicable',
    "attestation_frequency" "AttestationFrequency" NOT NULL DEFAULT 'not_applicable',
    "evidence_freshness_days" INTEGER,
    "next_regulatory_review_at" TIMESTAMP(3),
    "accountable_user_id" TEXT,
    "responsible_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "consulted_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "informed_user_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attestation_status" "AttestationStatus" NOT NULL DEFAULT 'not_required',
    "last_attested_at" TIMESTAMP(3),
    "last_attested_by" VARCHAR(255),
    "attestation_expires_at" TIMESTAMP(3),
    "action_steps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "module_relevance" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "framework_mappings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "calendar_event_id" VARCHAR(255),
    "scheduled_start" TIMESTAMP(3),
    "scheduled_end" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compliance_tasks_workstream_id_status_idx" ON "compliance_tasks"("workstream_id", "status");
CREATE INDEX "compliance_tasks_priority_tier_status_idx" ON "compliance_tasks"("priority_tier", "status");
CREATE INDEX "compliance_tasks_due_date_idx" ON "compliance_tasks"("due_date");
CREATE INDEX "compliance_tasks_accountable_user_id_idx" ON "compliance_tasks"("accountable_user_id");
CREATE INDEX "compliance_tasks_is_active_idx" ON "compliance_tasks"("is_active");

ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_workstream_id_fkey"
    FOREIGN KEY ("workstream_id") REFERENCES "workstreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_accountable_user_id_fkey"
    FOREIGN KEY ("accountable_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- STEP 6: Create task_citations join table
CREATE TABLE "task_citations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "task_id" UUID NOT NULL,
    "citation_id" UUID NOT NULL,
    "relevance_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_citations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "task_citations_task_id_citation_id_key" ON "task_citations"("task_id", "citation_id");
CREATE INDEX "task_citations_task_id_idx" ON "task_citations"("task_id");
CREATE INDEX "task_citations_citation_id_idx" ON "task_citations"("citation_id");

ALTER TABLE "task_citations" ADD CONSTRAINT "task_citations_task_id_fkey"
    FOREIGN KEY ("task_id") REFERENCES "compliance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_citations" ADD CONSTRAINT "task_citations_citation_id_fkey"
    FOREIGN KEY ("citation_id") REFERENCES "citations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- STEP 7: CHECK constraints on compliance_tasks
ALTER TABLE "compliance_tasks" ADD CONSTRAINT compliance_tasks_penalty_range_valid
    CHECK ("penalty_min_amount" IS NULL OR "penalty_max_amount" IS NULL
           OR "penalty_min_amount" <= "penalty_max_amount");

ALTER TABLE "compliance_tasks" ADD CONSTRAINT compliance_tasks_effort_range_valid
    CHECK ("estimated_effort_hours_min" IS NULL OR "estimated_effort_hours_max" IS NULL
           OR "estimated_effort_hours_min" <= "estimated_effort_hours_max");

ALTER TABLE "compliance_tasks" ADD CONSTRAINT compliance_tasks_cost_range_valid
    CHECK ("estimated_cost_min" IS NULL OR "estimated_cost_max" IS NULL
           OR "estimated_cost_min" <= "estimated_cost_max");

ALTER TABLE "compliance_tasks" ADD CONSTRAINT compliance_tasks_penalty_weight_valid
    CHECK ("penalty_weight" >= 0 AND "penalty_weight" <= 100);

ALTER TABLE "compliance_tasks" ADD CONSTRAINT compliance_tasks_evidence_freshness_valid
    CHECK ("evidence_freshness_days" IS NULL OR "evidence_freshness_days" > 0);
