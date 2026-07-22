-- DIM-1: the dimensional schema — LINKS (allocation links with % splits) +
-- VENDOR (journal_entries → operations_vendor_directory referentiality).
--
-- ADDITIVE-ONLY BY DESIGN (the HARD-GATE posture): one new table + one nullable
-- FK column. Zero data rewrites, zero NOT NULLs on populated tables, zero
-- changes to existing rows — closing_periods semantics untouched (no posted
-- row is modified by this migration). Pre-DIM rows are the LEGACY EPOCH:
-- dimensionless by design, never backfilled.
--
-- Applied by Alex via psql (repo law: schema.prisma + this SQL move together;
-- Claude Code authors the file only).

-- ─── The LINKS dimension: per-line allocation ────────────────────────────────
-- id types matched to their targets (verified against schema.prisma):
--   ledger_entries.id            TEXT  (String @default(uuid()), no @db.Uuid)
--   operations_projects.id       UUID
--   operations_routines.id       UUID
--   trips.id                     TEXT  (cuid)
--   operations_vendor_directory.id UUID
CREATE TABLE "ledger_line_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ledger_entry_id" TEXT NOT NULL,
    "project_id" UUID,
    "routine_id" UUID,
    "trip_id" TEXT,
    "module_key" VARCHAR(20),
    "percent" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "ledger_line_links_pkey" PRIMARY KEY ("id"),

    -- EXACTLY ONE target per link row — real referential integrity over
    -- polymorphic strings. (Prisma cannot model CHECK constraints — the
    -- chart_of_accounts precedent, schema.prisma:146 — so it lives here and
    -- is documented on the model.)
    CONSTRAINT "ledger_line_links_exactly_one_target" CHECK (
        (("project_id" IS NOT NULL)::int
       + ("routine_id" IS NOT NULL)::int
       + ("trip_id"    IS NOT NULL)::int
       + ("module_key" IS NOT NULL)::int) = 1
    )
);

-- Line FK: links die with their line (Cascade — an allocation cannot outlive
-- the ledger line it allocates).
ALTER TABLE "ledger_line_links"
    ADD CONSTRAINT "ledger_line_links_ledger_entry_id_fkey"
    FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Target FKs: RESTRICT — financial attribution never vanishes because a target
-- was deleted. SetNull is impossible (it would violate the exactly-one CHECK);
-- Cascade would silently erase financial rows. Restrict = fail-loud, mirroring
-- ledger_entries' own Restrict doctrine (journal_entry/account, schema.prisma
-- :226-228): deleting a linked project/routine/trip fails visibly until its
-- links are re-coded.
ALTER TABLE "ledger_line_links"
    ADD CONSTRAINT "ledger_line_links_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "operations_projects"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_line_links"
    ADD CONSTRAINT "ledger_line_links_routine_id_fkey"
    FOREIGN KEY ("routine_id") REFERENCES "operations_routines"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ledger_line_links"
    ADD CONSTRAINT "ledger_line_links_trip_id_fkey"
    FOREIGN KEY ("trip_id") REFERENCES "trips"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most ONE link per (line, specific target): four PARTIAL unique indexes —
-- a plain composite unique cannot enforce this (Postgres treats NULLs as
-- distinct). Prisma cannot model partial indexes; documented on the model.
CREATE UNIQUE INDEX "ledger_line_links_line_project_uniq"
    ON "ledger_line_links"("ledger_entry_id", "project_id") WHERE "project_id" IS NOT NULL;
CREATE UNIQUE INDEX "ledger_line_links_line_routine_uniq"
    ON "ledger_line_links"("ledger_entry_id", "routine_id") WHERE "routine_id" IS NOT NULL;
CREATE UNIQUE INDEX "ledger_line_links_line_trip_uniq"
    ON "ledger_line_links"("ledger_entry_id", "trip_id") WHERE "trip_id" IS NOT NULL;
CREATE UNIQUE INDEX "ledger_line_links_line_module_uniq"
    ON "ledger_line_links"("ledger_entry_id", "module_key") WHERE "module_key" IS NOT NULL;

-- Lookup indexes (allocation reports read by target).
CREATE INDEX "ledger_line_links_ledger_entry_id_idx" ON "ledger_line_links"("ledger_entry_id");
CREATE INDEX "ledger_line_links_project_id_idx" ON "ledger_line_links"("project_id");
CREATE INDEX "ledger_line_links_routine_id_idx" ON "ledger_line_links"("routine_id");
CREATE INDEX "ledger_line_links_trip_id_idx" ON "ledger_line_links"("trip_id");
CREATE INDEX "ledger_line_links_module_key_idx" ON "ledger_line_links"("module_key");

-- NOTE — sum-to-100 is deliberately NOT a constraint here: percents across a
-- line's links totalling 100.00 is a CROSS-ROW invariant no per-row CHECK can
-- express. DIM-3's write path enforces it (and percent range) FAIL-LOUD at
-- coding time. Nothing in between guesses.

-- ─── The VENDOR dimension: one payee per bill, at entry level ────────────────
-- Nullable + additive: existing journal_entries rows keep vendor_id NULL (the
-- legacy epoch). onDelete SET NULL per the T-D7 doctrine — financial records
-- never die by reference (schema.prisma:1254 precedent).
ALTER TABLE "journal_entries" ADD COLUMN "vendor_id" UUID;

ALTER TABLE "journal_entries"
    ADD CONSTRAINT "journal_entries_vendor_id_fkey"
    FOREIGN KEY ("vendor_id") REFERENCES "operations_vendor_directory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "journal_entries_vendor_id_idx" ON "journal_entries"("vendor_id");
