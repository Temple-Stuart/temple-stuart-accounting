-- PR-B: Citations table + verification protocol
-- Creates citations table with stable URIs, version locking,
-- hierarchical references, supersession chains, and 8-step
-- verification check result columns.

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('statute', 'regulation', 'case_opinion', 'agency_guidance', 'agency_enforcement_order', 'treaty', 'professional_standard', 'technical_standard', 'legislative_history', 'state_attorney_general_opinion', 'no_action_letter', 'comment_letter', 'other');

-- CreateEnum
CREATE TYPE "CitationStatus" AS ENUM ('verified', 'unverified', 'superseded', 'withdrawn', 'unreachable', 'pending_review');

-- CreateEnum
CREATE TYPE "VerificationCheckResult" AS ENUM ('passed', 'failed', 'not_applicable', 'error');

-- CreateTable
CREATE TABLE "citations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "regulatory_source_id" UUID NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "citation_string" VARCHAR(500) NOT NULL,
    "pinpoint" TEXT,
    "stable_uri" VARCHAR(1000) NOT NULL,
    "retrieved_url" VARCHAR(1000) NOT NULL,
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "retrieved_content_hash" VARCHAR(64) NOT NULL,
    "retrieval_method" VARCHAR(50) NOT NULL,
    "version_label" VARCHAR(255) NOT NULL,
    "effective_date" TIMESTAMP(3),
    "superseded_by_citation_id" UUID,
    "parent_citation_id" UUID,
    "status" "CitationStatus" NOT NULL DEFAULT 'unverified',
    "last_verified_at" TIMESTAMP(3),
    "last_verified_by" VARCHAR(100),
    "verification_notes" TEXT,
    "existence_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "currency_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "groundedness_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "pinpoint_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "supersession_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "jurisdiction_match_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "source_authority_match_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "content_hash_check" "VerificationCheckResult" NOT NULL DEFAULT 'not_applicable',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "citations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "citations_stable_uri_key" ON "citations"("stable_uri");

-- CreateIndex
CREATE INDEX "citations_regulatory_source_id_idx" ON "citations"("regulatory_source_id");

-- CreateIndex
CREATE INDEX "citations_document_type_status_idx" ON "citations"("document_type", "status");

-- CreateIndex
CREATE INDEX "citations_status_idx" ON "citations"("status");

-- CreateIndex
CREATE INDEX "citations_is_active_idx" ON "citations"("is_active");

-- AddForeignKey (source linkage)
ALTER TABLE "citations" ADD CONSTRAINT "citations_regulatory_source_id_fkey" FOREIGN KEY ("regulatory_source_id") REFERENCES "regulatory_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey (supersession self-referential)
ALTER TABLE "citations" ADD CONSTRAINT "citations_superseded_by_citation_id_fkey" FOREIGN KEY ("superseded_by_citation_id") REFERENCES "citations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey (hierarchy self-referential)
ALTER TABLE "citations" ADD CONSTRAINT "citations_parent_citation_id_fkey" FOREIGN KEY ("parent_citation_id") REFERENCES "citations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints (prevent self-referencing)
ALTER TABLE "citations" ADD CONSTRAINT "citations_no_self_supersession" CHECK ("id" != "superseded_by_citation_id");
ALTER TABLE "citations" ADD CONSTRAINT "citations_no_self_parent" CHECK ("id" != "parent_citation_id");
