-- CreateTable
CREATE TABLE "missions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal_description" TEXT NOT NULL,
    "done_definition" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_days" INTEGER NOT NULL,
    "milestones" JSONB NOT NULL DEFAULT '[]',
    "hours_per_day" DOUBLE PRECISION,
    "off_days" TEXT,
    "monthly_budget" DOUBLE PRECISION,
    "blockers" TEXT,
    "health_goals" TEXT,
    "personal_goals" TEXT,
    "meal_strategy" TEXT,
    "roadmap" JSONB,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "daily_plans" ADD COLUMN "mission_id" TEXT;

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "missions" ADD CONSTRAINT "missions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
