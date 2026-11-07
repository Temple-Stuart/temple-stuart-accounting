-- CRM-01a (Alex, 2026-11-06) — THE CRM'S WORKING TABLE: crm_contacts, ONE ROW PER CONTACT A USER IS WORKING.
--
-- The CRM page (/crm, GET /api/crm) reads the people you sell to in three tables: contacts, proposals and signups.
-- A proposal is a proposals row and a signup is a users row; neither has a place for the working facts of a contact —
-- its stage, its next step, the day it was last touched. proposals.status and proposals.owner_notes are the founder's
-- triage fields on the /owner inbox (CRM-01b retires them from /owner); they are not a CRM. This table holds those
-- facts, one row per contact a user is working, keyed to where the contact came from: a proposals row
-- ('proposal', its id), a users row ('signup', its id), or typed by hand ('manual', no source row — then a name and an
-- email are required).
--
-- THE RULING (CRM-01a, ruling E): the five stage words are proposals.status's own — new, reviewing, sent, won, lost
-- (src/app/api/owner/proposals/[id]/route.ts and src/app/owner/page.tsx hold the same five) — ONE vocabulary, nothing
-- carried over. A contact nobody has touched has no row here and reads as new. user_id is TEXT because users.id is,
-- as every foreign key to users declares it (20261012090000_stay_01_operations_stays/migration.sql). The unique index
-- is PARTIAL — one working row per source row per user, while a 'manual' row has no source row — which Prisma cannot
-- declare; schema.prisma names it in a comment.
--
-- Nothing writes this table in CRM-01a: GET /api/crm reads it (the reader's own rows) and every contact reads as new.
-- CRM-01b writes it (the stage, the next step, a contact added by hand).
--
-- AUTHORED, NOT APPLIED to any shared database. Claude Code cannot reach Azure Postgres. It applies at the production
-- deploy after the merge, through the build's migration gate (PREVIEW-DB-01: a preview never migrates). Until then
-- GET /api/crm's read of crm_contacts fails, and the page says so in its failed line — never an empty table that
-- pretends.

CREATE TABLE "crm_contacts" (
  "id"            UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       TEXT NOT NULL,
  "source"        VARCHAR(20) NOT NULL,
  "source_ref"    TEXT,
  "name"          VARCHAR(255),
  "business"      TEXT,
  "email"         VARCHAR(255),
  "stage"         VARCHAR(20) NOT NULL DEFAULT 'new',
  "next_step"     TEXT,
  "last_touch_at" TIMESTAMPTZ(6),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_contacts_source_chk" CHECK ("source" IN ('proposal', 'signup', 'manual')),
  CONSTRAINT "crm_contacts_stage_chk"  CHECK ("stage" IN ('new', 'reviewing', 'sent', 'won', 'lost')),
  CONSTRAINT "crm_contacts_ref_chk"    CHECK (("source" = 'manual') = ("source_ref" IS NULL)),
  CONSTRAINT "crm_contacts_manual_chk" CHECK ("source" <> 'manual' OR ("name" IS NOT NULL AND "email" IS NOT NULL))
);
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "crm_contacts_user_source_ref_key" ON "crm_contacts" ("user_id", "source", "source_ref") WHERE "source_ref" IS NOT NULL;
CREATE INDEX "crm_contacts_user_id_idx" ON "crm_contacts" ("user_id");
