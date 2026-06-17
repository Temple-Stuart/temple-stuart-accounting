-- HB-4a: give routines a per-occurrence budget + a COA.
-- ADDITIVE ONLY — both columns NULLABLE (existing routines are unaffected; a routine with no
-- budget stays NULL, never 0). No ALTER of existing columns, no DROP, no NOT NULL, no backfill.
--
--   budget_amount  numeric(12,2)  — per-occurrence money amount. Precision matches
--                                   budget_line_items.amount (the eventual bridge target).
--   coa_code       text           — soft ref to chart_of_accounts.code (validated in the UI,
--                                   HB-4b). No FK (mirrors calendar_events/hub_scheduled_items
--                                   coa_code soft refs).
--
-- The monthly budget figure is NOT stored — it is computed on-read later (HB-4c:
-- occurrences-in-month × budget_amount) and merged into the homepage budget section (HB-4d).

ALTER TABLE operations_routines
  ADD COLUMN IF NOT EXISTS budget_amount numeric(12,2),
  ADD COLUMN IF NOT EXISTS coa_code      text;

-- Verify:
-- SELECT name, budget_amount, coa_code FROM operations_routines
--   WHERE user_id = 'cmfi3rcrl0000zcj0ajbj4za5' LIMIT 5;
