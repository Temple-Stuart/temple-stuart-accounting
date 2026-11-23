-- HOME-SERVICES-02 (Alex, 2026-11-16 12:59 + 13:24 Manila) — EACH SERVICE ASKS ITS OWN QUESTIONS; ONE COLUMN HOLDS THE ANSWERS.
--
-- THE RULING (m): "THE ANSWERS ARE STORED IN ONE NEW COLUMN. One migration adds answers, jsonb, to proposals: the website,
-- the decision role and the picked service's answered questions, each under its key. Name, email, business, need and the
-- referral keep their columns. The columns only the old questions filled stop being written for new rows, and lose NOT NULL
-- and any default, so a new row holds NULL there rather than a value nobody gave. No old row is read, changed or deleted.
-- The migration is authored, not applied, in SERVICES-01's idiom: it applies at the production deploy through the build's
-- migration gate."
--
-- answers is JSONB, NULL, with no DEFAULT. Adding it rewrites no row: with no DEFAULT, NULL is used for every existing row
-- (PostgreSQL 16, ALTER TABLE, Notes). A row stored before this migration reads NULL there; the route
-- (src/app/api/proposals/route.ts) writes it on every new row, each answer under its question's key in
-- src/lib/proposalNeeds.ts — so answers alone tells a new row from an old one.
--
-- THE OLD QUESTIONS' COLUMNS. current_stack, modules, start_window, budget_range and notes_from_them lose NOT NULL; modules
-- loses DEFAULT '[]' and start_window loses DEFAULT 'exploring', which would otherwise write a value nobody gave on a new row.
-- hard_deadline, deadline_driver, links and team_size are NULL already and carry no default: nothing changes on them. name,
-- email, business, need (proposals_need_chk, as SERVICES-01 left it), referral_source, status, owner_notes, ip_hash and the two
-- indexes are untouched. No existing row is read, updated or deleted: dropping NOT NULL or a DEFAULT changes no stored value.
--
-- AUTHORED, NOT APPLIED to any shared database. Claude Code cannot reach Azure Postgres. It applies at the production deploy
-- after Alex merges, through the build's migration gate (PREVIEW-DB-01: a preview never migrates). A database it has not
-- reached refuses a new proposal (answers is not a column there, and current_stack is still NOT NULL): the route answers its
-- generic 500 and logs the refusal by name — nothing is saved, nothing guessed.

ALTER TABLE "proposals" ADD COLUMN "answers" JSONB;
ALTER TABLE "proposals" ALTER COLUMN "current_stack" DROP NOT NULL;
ALTER TABLE "proposals" ALTER COLUMN "modules" DROP NOT NULL;
ALTER TABLE "proposals" ALTER COLUMN "modules" DROP DEFAULT;
ALTER TABLE "proposals" ALTER COLUMN "start_window" DROP NOT NULL;
ALTER TABLE "proposals" ALTER COLUMN "start_window" DROP DEFAULT;
ALTER TABLE "proposals" ALTER COLUMN "budget_range" DROP NOT NULL;
ALTER TABLE "proposals" ALTER COLUMN "notes_from_them" DROP NOT NULL;
