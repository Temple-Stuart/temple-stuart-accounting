-- SERVICES-01 (Alex, 2026-11-08 11:00 + 11:15) — BOOKKEEPING IS A DOOR; THE 2026 CLOSE RETIRES.
--
-- THE RULING. The DONE-FOR-YOU panel holds six equal doors — Full setup, Monthly maintenance, Custom builds,
-- Integration, Bookkeeping, Something else — and one module holds every door's key and words
-- (src/lib/proposalNeeds.ts SERVICES), read by the panel, the form and the CRM. The proposal form
-- (/work-with-me → POST /api/proposals → proposals) stores the door's key in proposals.need, held by a CHECK. The
-- CHECK gains one word: 'bookkeeping'. The idiom is ONE-FORM-01's (20261106120000_one_form_01_close_need) — drop the
-- CHECK by its production name and re-add it with the new word; never IF EXISTS, so a different name fails loud.
--
-- 'close' IS KEPT. The close door is gone — the form no longer offers it and the route no longer accepts it — but the
-- rows the old close door wrote keep their word, and the CRM prints them as LEGACY_NEED_TITLES.close. No existing row
-- is read, updated or deleted; no column changes; the old 'close' rows keep their word.
--
-- AUTHORED, NOT APPLIED to any shared database. Claude Code cannot reach Azure Postgres. It applies at the production
-- deploy after Alex merges, through the build's migration gate (PREVIEW-DB-01: a preview never migrates). A database
-- it has not reached refuses a 'bookkeeping' submission: the route answers its generic 500 and logs the refusal by
-- name (src/app/api/proposals/route.ts:155-160) — nothing is saved, nothing guessed.

ALTER TABLE "proposals" DROP CONSTRAINT "proposals_need_chk";
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk"
  CHECK ("need" IN ('setup', 'maintenance', 'custom', 'embed', 'unsure', 'bookkeeping', 'close'));
