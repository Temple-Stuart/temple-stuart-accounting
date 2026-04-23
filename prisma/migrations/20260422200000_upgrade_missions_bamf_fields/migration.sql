-- AlterTable
ALTER TABLE "missions" ADD COLUMN "broken_blockers" TEXT;
ALTER TABLE "missions" ADD COLUMN "risk_factors" TEXT;
ALTER TABLE "missions" ADD COLUMN "priority_1" TEXT;
ALTER TABLE "missions" ADD COLUMN "priority_2" TEXT;
ALTER TABLE "missions" ADD COLUMN "priority_3" TEXT;
ALTER TABLE "missions" ADD COLUMN "current_state" TEXT;
ALTER TABLE "missions" ADD COLUMN "focus_windows" TEXT;
ALTER TABLE "missions" ADD COLUMN "fixed_commitments" TEXT;
ALTER TABLE "missions" ADD COLUMN "weekend_schedule" TEXT;
ALTER TABLE "missions" ADD COLUMN "deep_work_hours" DOUBLE PRECISION;
ALTER TABLE "missions" ADD COLUMN "success_metrics" JSONB NOT NULL DEFAULT '[]';
