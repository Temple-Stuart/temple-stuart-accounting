-- TIMESHEET-04a (Alex, 2026-11-25 + 2026-11-27) — THREE COLUMNS: A VENDOR'S INSTAGRAM TAG, A PLAN'S PLANNED ITEMS, A STOP'S NOTES.
--
-- The sheet whose rows the time sheet takes in (PASTE-01, src/lib/operations/pasteRows.ts) carries three things the app had
-- nowhere to keep. Each gets a column of its own.
--
--   operations_vendor_directory.instagram_tag — a vendor's Instagram tag, without its @: letters, digits, dots and underscores,
--     1 to 30. The CHECK holds exactly that shape; the rule that reads a typed one is src/lib/operations/planVendor.ts
--     readInstagramTag. Ruled 2026-11-27: "tag is own column". WRITTEN by the directory route's PATCH
--     (src/app/api/operations/vendor-directory/route.ts) — that route's one update, which the vendor law pins to its shape.
--
--   planned_item_vendors.items — the items planned at a stop still ahead: one line, at most 280 characters, never blank (the
--     CHECK; the rule is planVendor.ts readPlannedItems). WRITTEN by the plan-vendors route
--     (src/app/api/operations/plan-vendors/route.ts), on the row that names the plan's vendor.
--
--   operations_stop_records.notes — notes on a stop: at most 2000 characters, never blank (the CHECK —
--     operations_stop_records_note_not_blank's own idiom, on the same table). It has NO READER AND NO WRITER until TIMESHEET-04b,
--     which writes it through the stops route, with the record. Until then every row reads NULL there.
--
-- NO BACKFILL. Each column admits NULL and carries no default, so adding it rewrites no row: PostgreSQL reads NULL there for every
-- row that already stands, and each CHECK admits NULL. No existing row of any table is read, updated or deleted. No index, no
-- trigger and no enum value is added: operations_vendor_updated, the audit type the tag's write uses, is in AuditActionType already
-- (20260507000000_pr_ops_1_schema_foundation).
--
-- AUTHORED, NOT APPLIED to any database. Claude Code cannot reach Azure Postgres. It applies at the production deploy after Alex
-- merges, through the build's own gate (scripts/migrate-gate.ts; PREVIEW-DB-01: a preview never migrates). A database it has not
-- reached holds none of the three columns, and the generated client names all three: there a query that reads or returns one of
-- them — any read or write of a whole row of these three tables — is refused by the database. Nothing is saved, nothing guessed.

ALTER TABLE "operations_vendor_directory" ADD COLUMN "instagram_tag" VARCHAR(30);
ALTER TABLE "operations_vendor_directory" ADD CONSTRAINT "operations_vendor_directory_instagram_tag_shape" CHECK ("instagram_tag" IS NULL OR "instagram_tag" ~ '^[A-Za-z0-9._]{1,30}$');
ALTER TABLE "planned_item_vendors" ADD COLUMN "items" VARCHAR(280);
ALTER TABLE "planned_item_vendors" ADD CONSTRAINT "planned_item_vendors_items_not_blank" CHECK ("items" IS NULL OR length(btrim("items")) > 0);
ALTER TABLE "operations_stop_records" ADD COLUMN "notes" VARCHAR(2000);
ALTER TABLE "operations_stop_records" ADD CONSTRAINT "operations_stop_records_notes_not_blank" CHECK ("notes" IS NULL OR length(btrim("notes")) > 0);
