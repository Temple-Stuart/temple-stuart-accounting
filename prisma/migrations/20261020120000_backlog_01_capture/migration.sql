-- BACKLOG-01 (Alex, 2026-10-20) — THE CAPTURE FORM AND ITS COLUMNS.
--
-- "The 'New project' form becomes the CAPTURE form": a project is captured with
-- its title, its TYPE, its book, its WHY, and optionally its size, its
-- definition of done, its links and its notes; it lands in the BACKLOG. The
-- Dalio loop (goal · problem · diagnosis · design) is "scope it" — the row's
-- edit view, which already has it. This migration is the capture's DATA;
-- BACKLOG-02 (the ranked view, the reorder) and BACKLOG-03 (the transitions)
-- build on it. On operations_projects:
--
--   ProjectStatus   + backlog · scoped · scheduled · dropped (the existing six
--                     stay; a captured project is set 'backlog' EXPLICITLY by
--                     the POST — the column's default is not changed and no
--                     existing row is rewritten)
--   "type"          ProjectType  engineering · accounting · content · travel ·
--                                ops — REQUIRED on the form and the POST for
--                                every new project; the COLUMN is nullable so a
--                                row captured before reads "—", never a default
--   "size"          ProjectSize  S · M · L — optional at capture ("not sized")
--   "why"           TEXT         the value or the problem, a paragraph —
--                                REQUIRED at capture; its cap of 4000 code
--                                points is the rule's own (JOURNAL-04's shape)
--                                on a TEXT column the database does not bound
--   "definition_of_done" TEXT    optional at capture (BACKLOG-02 requires it to
--                                leave the backlog)
--   "links"         JSONB        a list of strings — the prompt doc's path, the
--                                PR's url — ≤ 20 of ≤ 500, the *_items shape;
--                                '[]' is "no links", the honest empty
--   "notes"         TEXT         optional
--   "rank"          INTEGER      a position in the ranked view — set ONLY by
--                                BACKLOG-02's reorder route; nothing types it
--                                and nothing sorts by it yet; NULL or > 0
--   "promoted_at", "scheduled_at", "done_at"  TIMESTAMPTZ  written by
--                                BACKLOG-03's transitions only
--
-- NULL is "not stated" on every column but links — no default, never "".
--
-- NOTE: `ALTER TYPE ... ADD VALUE` cannot run inside a BEGIN/COMMIT block. The
-- four statements are bare (no explicit transaction) so they run in autocommit,
-- the way 20260605000000_pr_ops_archive_task_status adds 'archived'; IF NOT
-- EXISTS keeps deploy idempotent. No statement in this file USES one of the
-- four new values (the index below names the column, not a value), so there is
-- no "new enum value in the same transaction" hazard.
--
-- Additive only — safe on `prisma migrate deploy`, no backfill; applied at
-- deploy after merge (package.json "build"), never by hand from a session.

ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'backlog';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'scoped';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'scheduled';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'dropped';

CREATE TYPE "ProjectType" AS ENUM ('engineering', 'accounting', 'content', 'travel', 'ops');
CREATE TYPE "ProjectSize" AS ENUM ('S', 'M', 'L');

ALTER TABLE "operations_projects"
  ADD COLUMN "type" "ProjectType",
  ADD COLUMN "size" "ProjectSize",
  ADD COLUMN "why" TEXT,
  ADD COLUMN "definition_of_done" TEXT,
  ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "rank" INTEGER,
  ADD COLUMN "promoted_at" TIMESTAMPTZ(6),
  ADD COLUMN "scheduled_at" TIMESTAMPTZ(6),
  ADD COLUMN "done_at" TIMESTAMPTZ(6);

-- A rank is a position: NULL (unranked) or a positive integer — 0 and negatives refused.
ALTER TABLE "operations_projects"
  ADD CONSTRAINT "operations_projects_rank_positive" CHECK ("rank" IS NULL OR "rank" > 0);

CREATE INDEX "operations_projects_user_id_status_rank_idx" ON "operations_projects"("user_id", "status", "rank");
