-- ONE-FORM-01 (Alex, 2026-11-06) — THE 2026 CLOSE IS BOOKED ON THE PROPOSAL FORM, NOT BY EMAIL.
--
-- Alex: "incorporate bookkeeping services and done for you services ... all as one proposal form ... since email is
-- wack." The proposal form (/work-with-me → POST /api/proposals → proposals) asks "what do you need?" and the table
-- holds the answer to five words with a CHECK: setup, maintenance, custom, embed, unsure. The 2026 close
-- (src/lib/offer/close.ts, HOME-05a) becomes the sixth: 'close'. The idiom is TRAVEL-02b's — drop the CHECK, re-add
-- it with the new word. No row is touched; no column changes; the five old words stay valid.
--
-- THE CONSTRAINT'S NAME is production's own: Alex's `\d proposals` on production, 2026-11-03 20:38 Manila (the
-- OWNER-DASH v2 DDL he ran by psql on 2026-08-12 created the table; no migration did), recorded in
-- claude/home-05-facts.md: proposals_need_chk CHECK (need IN ('setup', 'maintenance', 'custom', 'embed', 'unsure')).
-- A different name fails loud here — never IF EXISTS, never a second constraint beside a stale one.
--
-- The code's own list of needs moves in lockstep: src/app/api/proposals/route.ts (the zod enum) and
-- src/app/work-with-me/WorkWithMeForm.tsx (the choices), both reading the sixth word from the leaf
-- (CLOSE_OFFER.need) — the word is typed once.
--
-- AUTHORED, NOT APPLIED to any shared database. Claude Code cannot reach Azure Postgres. It applies at the production
-- deploy after the merge, through the build's migration gate (PREVIEW-DB-01: a preview never migrates). Until then a
-- 'close' submission is refused by the database and the route answers 500 by name — nothing is saved, nothing guessed.

ALTER TABLE "proposals" DROP CONSTRAINT "proposals_need_chk";
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_need_chk"
  CHECK ("need" IN ('setup', 'maintenance', 'custom', 'embed', 'unsure', 'close'));
