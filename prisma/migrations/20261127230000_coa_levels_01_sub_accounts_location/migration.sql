-- COALEVELS-01 (Alex, 2026-11-27) — A TABLE AND A COLUMN: THE CHART'S SUB-ACCOUNTS, AND A STOP'S LOCATION.
--
-- The account a stop is charged to has two levels the app had nowhere to keep: under a chart account (the CATEGORY) its TYPE,
-- and beside the book (the ENTITY) whether the stop is travel or homebase (its LOCATION).
--
--   chart_of_sub_accounts — NEW. A two-digit code and a name under ONE row of chart_of_accounts: the account is the category,
--     the sub-account the type. The code is two digits (a CHECK) and stands once under its account, as its name does (the two
--     unique indexes); the name is never blank (a CHECK). A stop is tied to its sub-account by its NAME, so no plan row stores a
--     sub-account's code. None is deleted: is_archived retires one, and the account it sits under cannot be deleted from under
--     it (ON DELETE RESTRICT); a deleted user's go with the user (ON DELETE CASCADE). The rule is src/lib/coa/subAccounts.ts.
--     WRITTEN by POST /api/chart-of-accounts/sub-accounts (src/app/api/chart-of-accounts/sub-accounts/route.ts) — the table's
--     one writer.
--
--   operations_routines.location_class — a stop's Location: 'travel', 'homebase', or NULL — not said (the CHECK). The stop's
--     own; every line of the routine shares it. It is NOT operations_routines.location, which is the venue's text. The rule is
--     src/lib/operations/locationClass.ts. WRITTEN by the routines routes — src/app/api/operations/routines/route.ts on
--     create, src/app/api/operations/routines/[id]/route.ts on edit.
--
-- NO BACKFILL. The table is created empty. The column admits NULL and carries no default, so adding it rewrites no row:
-- PostgreSQL reads NULL there for every routine that already stands, and its CHECK admits NULL. No existing row of any table
-- is read, updated or deleted. No trigger and no enum value is added.
--
-- AUTHORED, NOT APPLIED to any database. Claude Code cannot reach Azure Postgres. It applies at the production deploy after Alex
-- merges, through the build's own gate (scripts/migrate-gate.ts; PREVIEW-DB-01: a preview never migrates). A database it has not
-- reached holds neither the table nor the column, and the generated client names both: there a read of the table, and any read
-- or write of a whole row of operations_routines, is refused by the database. Nothing is saved, nothing guessed.

CREATE TABLE "chart_of_sub_accounts" ("id" UUID NOT NULL DEFAULT gen_random_uuid(), "userId" TEXT NOT NULL, "account_id" UUID NOT NULL, "code" VARCHAR(2) NOT NULL, "name" VARCHAR(100) NOT NULL, "is_archived" BOOLEAN NOT NULL DEFAULT false, "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMPTZ(6) NOT NULL, "created_by" TEXT, CONSTRAINT "chart_of_sub_accounts_pkey" PRIMARY KEY ("id"), CONSTRAINT "chart_of_sub_accounts_code_two_digits" CHECK ("code" ~ '^[0-9]{2}$'), CONSTRAINT "chart_of_sub_accounts_name_not_blank" CHECK (length(btrim("name")) > 0));
CREATE UNIQUE INDEX "chart_of_sub_accounts_account_id_code_key" ON "chart_of_sub_accounts"("account_id", "code");
CREATE UNIQUE INDEX "chart_of_sub_accounts_account_id_name_key" ON "chart_of_sub_accounts"("account_id", "name");
CREATE INDEX "chart_of_sub_accounts_userId_idx" ON "chart_of_sub_accounts"("userId");
ALTER TABLE "chart_of_sub_accounts" ADD CONSTRAINT "chart_of_sub_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chart_of_sub_accounts" ADD CONSTRAINT "chart_of_sub_accounts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operations_routines" ADD COLUMN "location_class" VARCHAR(10);
ALTER TABLE "operations_routines" ADD CONSTRAINT "operations_routines_location_class_known" CHECK ("location_class" IS NULL OR "location_class" IN ('travel', 'homebase'));
