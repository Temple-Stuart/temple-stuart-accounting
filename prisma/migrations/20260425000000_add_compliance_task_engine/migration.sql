-- CreateTable: compliance_tasks
CREATE TABLE "compliance_tasks" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "workstream_id" TEXT NOT NULL,
    "question_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "action_steps" TEXT NOT NULL,
    "research_links" TEXT,
    "estimated_cost_min" DOUBLE PRECISION,
    "estimated_cost_max" DOUBLE PRECISION,
    "estimated_effort" TEXT,
    "effort_quantity" INTEGER,
    "deadline" TIMESTAMP(3),
    "deadline_label" TEXT,
    "calendar_event_id" TEXT,
    "calendar_start" TIMESTAMP(3),
    "calendar_end" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "blocked_by_tasks" TEXT,
    "statute" TEXT,
    "penalty_range" TEXT,
    "source_analysis_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_evidence
CREATE TABLE "task_evidence" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "evidence_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_evidence_documents
CREATE TABLE "task_evidence_documents" (
    "id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_path" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "expiration_date" TIMESTAMP(3),
    "expiration_alert_sent" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_evidence_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_evidence_code
CREATE TABLE "task_evidence_code" (
    "id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "start_line" INTEGER NOT NULL,
    "end_line" INTEGER NOT NULL,
    "function_name" TEXT,
    "description" TEXT NOT NULL,
    "code_snapshot" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "commit_hash" TEXT NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "stale_detected_at" TIMESTAMP(3),
    "last_verified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_evidence_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable: task_evidence_urls
CREATE TABLE "task_evidence_urls" (
    "id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "archived_content" TEXT,
    "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_accessible" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "task_evidence_urls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "compliance_tasks_mission_id_module_id_question_id_key" ON "compliance_tasks"("mission_id", "module_id", "question_id");
CREATE INDEX "compliance_tasks_user_id_idx" ON "compliance_tasks"("user_id");
CREATE INDEX "compliance_tasks_mission_id_module_id_idx" ON "compliance_tasks"("mission_id", "module_id");
CREATE INDEX "compliance_tasks_mission_id_module_id_workstream_id_idx" ON "compliance_tasks"("mission_id", "module_id", "workstream_id");
CREATE INDEX "compliance_tasks_status_idx" ON "compliance_tasks"("status");
CREATE INDEX "compliance_tasks_deadline_idx" ON "compliance_tasks"("deadline");
CREATE INDEX "compliance_tasks_calendar_start_calendar_end_idx" ON "compliance_tasks"("calendar_start", "calendar_end");

CREATE INDEX "task_evidence_task_id_idx" ON "task_evidence"("task_id");
CREATE INDEX "task_evidence_user_id_idx" ON "task_evidence"("user_id");

CREATE UNIQUE INDEX "task_evidence_documents_evidence_id_key" ON "task_evidence_documents"("evidence_id");
CREATE INDEX "task_evidence_documents_expiration_date_idx" ON "task_evidence_documents"("expiration_date");

CREATE UNIQUE INDEX "task_evidence_code_evidence_id_key" ON "task_evidence_code"("evidence_id");
CREATE INDEX "task_evidence_code_is_stale_idx" ON "task_evidence_code"("is_stale");
CREATE INDEX "task_evidence_code_file_path_idx" ON "task_evidence_code"("file_path");

CREATE UNIQUE INDEX "task_evidence_urls_evidence_id_key" ON "task_evidence_urls"("evidence_id");

-- AddForeignKey
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "compliance_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "task_evidence_documents" ADD CONSTRAINT "task_evidence_documents_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "task_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_evidence_code" ADD CONSTRAINT "task_evidence_code_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "task_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "task_evidence_urls" ADD CONSTRAINT "task_evidence_urls_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "task_evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
