-- CRM-02 (Alex, 2026-11-07) — EVERY ACCOUNT'S OWN INTAKE FORM, AND WHAT IT BRINGS IN: crm_forms and crm_form_submissions.
--
-- The CRM (/crm) is the people you sell to. Until now only the platform's own proposal form (/work-with-me) and the
-- platform's signups filled it, and only for the platform owner; anyone else could add a contact by hand. This gives every
-- account ONE form of its own at its own public link (/f/<slug>) and as an embed on their own site (/f/<slug>?embed=1),
-- whose submissions fill THAT account's CRM alone.
--
-- crm_forms — ONE ROW PER ACCOUNT (crm_forms_user_id_key, CLOSED 2). The slug is GLOBAL (crm_forms_slug_key): 3 to 40
-- characters, lowercase letters, digits and hyphens, starting and ending with a letter or digit (crm_forms_slug_chk —
-- the same pattern src/lib/crm/forms.ts FORM_SLUG_RE reads); nothing is lowercased or trimmed for it, a miss is refused
-- by name and a taken slug is 409. The form is three FIXED fields (name, email, business — the three the Contacts row
-- shows, always first, never in this JSON) plus up to twelve questions of the account's own (crm_forms_questions_chk:
-- a JSON array of at most 12 — { id, label, kind, required, shown }; the ids are the server's, CLOSED 3). A hidden
-- question is kept (its past answers still show) and not asked. title is never blank (crm_forms_title_chk); line is
-- NULL or never blank (crm_forms_line_chk).
--
-- crm_form_submissions — ONE ROW PER SUBMISSION, FROZEN AS IT CAME IN (CLOSED 4): answers holds the questions AS ASKED,
-- [{ id, label, kind, required, value }] (crm_form_submissions_answers_chk: a JSON array), so a later edit of the form
-- never rewrites a submission; nothing is deleted (form_id ON DELETE RESTRICT — a form with submissions is not dropped
-- under them; a form's deletion is not built). user_id is the FORM OWNER'S, denormalized from the form on insert, so every
-- read of this table is WHERE user_id = the caller's — the ownership law's shape (SEC-02) — and the submission is a CRM
-- source of its own: crm_contacts_source_chk widens to four words ('form'), and its ContactRow.key is 'form:<id>'.
-- name and email are never blank (crm_form_submissions_name_chk, _email_chk). created_at is TIMESTAMPTZ — a came-in fact
-- is an instant; crm_contacts' TIMESTAMP(3) is CRM-01a's and stays. user_id is TEXT because users.id is, as every foreign
-- key to users declares it (20261012090000_stay_01_operations_stays/migration.sql).
--
-- WHAT WRITES THEM: PUT /api/crm/form (the caller's own row — update WHERE { id, user_id } or create with user_id) and
-- POST /api/f/<slug> (public BY RULING, CLOSED 1: the proposal route's guards in the proposal route's order — honeypot,
-- per-ip_hash rate limit 5/hour, the form by slug, zod, the ONE insert). Nothing is sent from here.
--
-- AUTHORED, NOT APPLIED to any shared database. Claude Code cannot reach Azure Postgres. It applies at the production
-- deploy after the merge, through the build's migration gate (PREVIEW-DB-01: a preview never migrates). Until then
-- GET /api/crm's read of crm_forms fails, and the page says so in its failed line — never an empty block that pretends.

CREATE TABLE "crm_forms" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    TEXT NOT NULL,
  "slug"       VARCHAR(40) NOT NULL,
  "title"      VARCHAR(120) NOT NULL,
  "line"       VARCHAR(500),
  "questions"  JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "crm_forms_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_forms_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "crm_forms_slug_key" UNIQUE ("slug"),
  CONSTRAINT "crm_forms_slug_chk" CHECK ("slug" ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])?$' AND length("slug") >= 3),
  CONSTRAINT "crm_forms_title_chk" CHECK (btrim("title") <> ''),
  CONSTRAINT "crm_forms_line_chk" CHECK ("line" IS NULL OR btrim("line") <> ''),
  CONSTRAINT "crm_forms_questions_chk" CHECK (jsonb_typeof("questions") = 'array' AND jsonb_array_length("questions") <= 12)
);
ALTER TABLE "crm_forms" ADD CONSTRAINT "crm_forms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "crm_form_submissions" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "form_id"    UUID NOT NULL,
  "user_id"    TEXT NOT NULL,
  "name"       VARCHAR(255) NOT NULL,
  "email"      VARCHAR(255) NOT NULL,
  "business"   TEXT,
  "answers"    JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "crm_form_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_form_submissions_name_chk" CHECK (btrim("name") <> ''),
  CONSTRAINT "crm_form_submissions_email_chk" CHECK (btrim("email") <> ''),
  CONSTRAINT "crm_form_submissions_answers_chk" CHECK (jsonb_typeof("answers") = 'array')
);
ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_form_id_fkey" FOREIGN KEY ("form_id") REFERENCES "crm_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "crm_form_submissions" ADD CONSTRAINT "crm_form_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "crm_form_submissions_user_created_idx" ON "crm_form_submissions" ("user_id", "created_at");
CREATE INDEX "crm_form_submissions_form_id_idx" ON "crm_form_submissions" ("form_id");

ALTER TABLE "crm_contacts" DROP CONSTRAINT "crm_contacts_source_chk";
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_source_chk" CHECK ("source" IN ('proposal', 'signup', 'manual', 'form'));
