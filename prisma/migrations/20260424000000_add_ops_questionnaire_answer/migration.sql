-- CreateTable
CREATE TABLE "ops_questionnaire_answers" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "workstream_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "answer_value" TEXT NOT NULL,
    "question_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ops_questionnaire_answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ops_questionnaire_answers_mission_id_module_id_question_id_key" ON "ops_questionnaire_answers"("mission_id", "module_id", "question_id");

-- CreateIndex
CREATE INDEX "ops_questionnaire_answers_user_id_idx" ON "ops_questionnaire_answers"("user_id");

-- CreateIndex
CREATE INDEX "ops_questionnaire_answers_mission_id_module_id_idx" ON "ops_questionnaire_answers"("mission_id", "module_id");

-- CreateIndex
CREATE INDEX "ops_questionnaire_answers_mission_id_module_id_workstream_id_idx" ON "ops_questionnaire_answers"("mission_id", "module_id", "workstream_id");

-- AddForeignKey
ALTER TABLE "ops_questionnaire_answers" ADD CONSTRAINT "ops_questionnaire_answers_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_questionnaire_answers" ADD CONSTRAINT "ops_questionnaire_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
