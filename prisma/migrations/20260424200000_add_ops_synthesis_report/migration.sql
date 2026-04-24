-- CreateTable
CREATE TABLE "ops_synthesis_report" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "synthesis_output" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "workstreams_covered" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_synthesis_report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ops_synthesis_report_mission_id_module_id_key" ON "ops_synthesis_report"("mission_id", "module_id");

-- CreateIndex
CREATE INDEX "ops_synthesis_report_user_id_idx" ON "ops_synthesis_report"("user_id");

-- AddForeignKey
ALTER TABLE "ops_synthesis_report" ADD CONSTRAINT "ops_synthesis_report_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_synthesis_report" ADD CONSTRAINT "ops_synthesis_report_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
