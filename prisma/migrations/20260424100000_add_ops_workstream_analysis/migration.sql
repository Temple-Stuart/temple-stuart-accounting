-- CreateTable
CREATE TABLE "ops_workstream_analysis" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "workstream_id" TEXT NOT NULL,
    "analysis_output" TEXT NOT NULL,
    "model_used" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_workstream_analysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ops_workstream_analysis_mission_id_module_id_workstream_id_key" ON "ops_workstream_analysis"("mission_id", "module_id", "workstream_id");

-- CreateIndex
CREATE INDEX "ops_workstream_analysis_user_id_idx" ON "ops_workstream_analysis"("user_id");

-- CreateIndex
CREATE INDEX "ops_workstream_analysis_mission_id_module_id_idx" ON "ops_workstream_analysis"("mission_id", "module_id");

-- AddForeignKey
ALTER TABLE "ops_workstream_analysis" ADD CONSTRAINT "ops_workstream_analysis_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_workstream_analysis" ADD CONSTRAINT "ops_workstream_analysis_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
