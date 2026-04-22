-- CreateTable
CREATE TABLE "daily_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "day_number" INTEGER NOT NULL,
    "sprint_start_date" DATE NOT NULL,
    "sprint_total_days" INTEGER NOT NULL DEFAULT 75,
    "mission" TEXT,
    "mission_completed" BOOLEAN NOT NULL DEFAULT false,
    "tasks" JSONB NOT NULL DEFAULT '[]',
    "schedule" JSONB NOT NULL DEFAULT '[]',
    "budget_target" DOUBLE PRECISION,
    "budget_actual" DOUBLE PRECISION,
    "weight_morning" DOUBLE PRECISION,
    "workout_planned" BOOLEAN NOT NULL DEFAULT false,
    "workout_completed" BOOLEAN NOT NULL DEFAULT false,
    "workout_type" TEXT,
    "workout_duration_min" INTEGER,
    "workout_notes" TEXT,
    "hydration_target_oz" INTEGER,
    "hydration_actual_oz" INTEGER,
    "calorie_target" INTEGER,
    "calorie_actual" INTEGER,
    "protein_target_g" INTEGER,
    "protein_actual_g" INTEGER,
    "meals" JSONB NOT NULL DEFAULT '[]',
    "sleep_hours" DOUBLE PRECISION,
    "sleep_quality" TEXT,
    "steps" INTEGER,
    "day_score" DOUBLE PRECISION,
    "reflection" TEXT,
    "wins" TEXT,
    "blockers" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_plans_user_id_date_key" ON "daily_plans"("user_id", "date");

-- AddForeignKey
ALTER TABLE "daily_plans" ADD CONSTRAINT "daily_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
