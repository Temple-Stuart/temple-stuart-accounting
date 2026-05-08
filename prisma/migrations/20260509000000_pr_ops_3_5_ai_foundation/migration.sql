-- PR-Ops-3.5: AI Foundation
-- Adds operations_ai_inference audit enum value and operations_ai_usage table
-- for cost tracking across all AI features in the operations workbench.
--
-- Postgres note: ALTER TYPE ADD VALUE is non-transactional in pre-12 and
-- cannot run inside a BEGIN/COMMIT block. Azure runs Postgres 14+, but
-- Prisma's migration runner handles this correctly when ALTER TYPE is the
-- only enum-modifying statement in its own statement group.

ALTER TYPE "AuditActionType" ADD VALUE 'operations_ai_inference';

CREATE TABLE "operations_ai_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "model" VARCHAR(100) NOT NULL,
    "purpose" VARCHAR(100) NOT NULL,
    "target_table" VARCHAR(100),
    "target_id" UUID,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "inputs_summary" TEXT,
    "output_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
    "created_by" TEXT,

    CONSTRAINT "operations_ai_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operations_ai_usage_user_created_idx"
    ON "operations_ai_usage" ("user_id", "created_at" DESC);

CREATE INDEX "operations_ai_usage_target_idx"
    ON "operations_ai_usage" ("target_table", "target_id");

CREATE INDEX "operations_ai_usage_purpose_created_idx"
    ON "operations_ai_usage" ("purpose", "created_at" DESC);

ALTER TABLE "operations_ai_usage"
    ADD CONSTRAINT "operations_ai_usage_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE NO ACTION ON UPDATE CASCADE;
