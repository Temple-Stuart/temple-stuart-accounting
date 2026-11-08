-- CASH-02a (Alex, 2026-11-08): a typed expense states how it was paid. NULL = not stated — every row typed before this migration; never backfilled.
ALTER TABLE "travel_expenses" ADD COLUMN "paid_with" VARCHAR(8);
ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_paid_with" CHECK ("paid_with" IS NULL OR "paid_with" IN ('cash', 'account'));
CREATE OR REPLACE FUNCTION prevent_travel_expense_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.paid_on IS DISTINCT FROM OLD.paid_on
     OR NEW.amount_minor IS DISTINCT FROM OLD.amount_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.vendor IS DISTINCT FROM OLD.vendor
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.trip_id IS DISTINCT FROM OLD.trip_id
     OR NEW.coa_code IS DISTINCT FROM OLD.coa_code
     OR NEW.paid_with IS DISTINCT FROM OLD.paid_with
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'A travel expense cannot be changed once kept. Only voided_at and void_reason may be set, once, when it is voided.';
  END IF;
  IF OLD.voided_at IS NOT NULL OR OLD.void_reason IS NOT NULL THEN
    RAISE EXCEPTION 'A travel expense is voided once: voided_at and void_reason cannot change or go back to NULL.';
  END IF;
  IF NEW.voided_at IS NULL OR NEW.void_reason IS NULL THEN
    RAISE EXCEPTION 'The one change a travel expense takes is its void: voided_at and void_reason, set together.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
