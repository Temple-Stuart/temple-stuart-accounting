-- HB-4a: give routines a per-occurrence budget.
-- ADDITIVE ONLY — the new column is NULLABLE (existing routines are unaffected; a routine with no
-- budget stays NULL, never 0). No ALTER of existing columns, no DROP, no NOT NULL, no backfill.
--
--   budget_amount  numeric(12,2)  — per-occurrence money amount (NEW). Precision matches
--                                   budget_line_items.amount (the eventual bridge target).
--
-- NOTE (HB-4a-fix): coa_code was NOT added here — it ALREADY EXISTED in the live
-- operations_routines table as character varying(50) (it had simply never been declared in
-- schema.prisma, a pre-existing drift). HB-4a-fix only aligns the schema declaration to
-- VarChar(50); there is NO coa_code DB change. So the only live DDL this PR needs is the
-- budget_amount ADD COLUMN below.
--
-- The monthly budget figure is NOT stored — it is computed on-read later (HB-4c:
-- occurrences-in-month × budget_amount) and merged into the homepage budget section (HB-4d).

ALTER TABLE operations_routines
  ADD COLUMN IF NOT EXISTS budget_amount numeric(12,2);

-- coa_code already exists as character varying(50) — declaration-only alignment in schema.prisma,
-- no DDL. (Left here for the record; do NOT re-add the column.)

-- Verify:
-- SELECT name, budget_amount, coa_code FROM operations_routines
--   WHERE user_id = 'cmfi3rcrl0000zcj0ajbj4za5' LIMIT 5;
