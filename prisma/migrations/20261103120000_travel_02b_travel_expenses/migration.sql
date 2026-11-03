-- TRAVEL-02b (Alex, 2026-11-03, rulings A and B) — THE TYPED TRAVEL EXPENSE, KEPT.
--
-- A visa, an eSIM or a one-off travel purchase is its own typed row: one user's,
-- stated in the currency it was paid in (ISO 4217, three letters, NO default —
-- FX-01: stated, never assumed), on the DAY it was paid (a calendar day, never an
-- instant), with the vendor as typed. TRAVEL-00's decision 6: a new user-scoped
-- table, not a routine. trip_expenses (the group-trip table) is not touched.
--
-- APPEND-ONLY, HELD HERE — not by convention (the source_documents precedent,
-- 20261028120000_documents_01_source_documents):
--   · FREEZE: every UPDATE is refused, except the void — voided_at and void_reason
--     set together, ONCE, from NULL, with every other column unchanged;
--   · NO DELETE: every DELETE is refused, and a TRUNCATE with it — a voided
--     expense stays, with its reason.
--
-- THE LINK (TRAVEL-00's decision 7): a typed expense is matched to its bank
-- posting by hand, through the one link rule — planned_item_links gains a sixth
-- kind, 'travel_expense' (the target_id is travel_expenses.id). The kind CHECK
-- TRAVEL-01 wrote (20260919100100_travel_01_trip_item_link_kind) is rewritten
-- with it; the instant CHECK LINES-01 wrote is untouched — it already forbids an
-- instant for every kind but routine and routine_line, so a travel_expense link
-- carries none, like calendar_event, project_task and trip_item. Nothing is
-- migrated; no link is created.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; Alex runs this
-- via psql, or it applies at deploy after merge (the build's prisma migrate deploy).

CREATE TABLE "travel_expenses" (
  "id"           UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      TEXT           NOT NULL,
  "kind"         VARCHAR(8)     NOT NULL,
  "paid_on"      DATE           NOT NULL,
  "amount_minor" INTEGER        NOT NULL,
  "currency"     VARCHAR(3)     NOT NULL,
  "vendor"       VARCHAR(120)   NOT NULL,
  "note"         TEXT,
  "trip_id"      TEXT,
  "coa_code"     VARCHAR(50),
  "voided_at"    TIMESTAMPTZ(6),
  "void_reason"  TEXT,
  "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "created_by"   TEXT           NOT NULL,

  CONSTRAINT "travel_expenses_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_kind"
  CHECK ("kind" IN ('visa', 'esim', 'other'));

ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_amount_positive"
  CHECK ("amount_minor" > 0);

ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_currency_three"
  CHECK (char_length("currency") = 3);

ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_vendor_not_blank"
  CHECK (char_length(btrim("vendor")) BETWEEN 1 AND 120);

-- Voided is both columns or neither, and the reason is never blank.
ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_void_pair"
  CHECK (("voided_at" IS NULL AND "void_reason" IS NULL)
      OR ("voided_at" IS NOT NULL AND "void_reason" IS NOT NULL AND char_length(btrim("void_reason")) > 0));

ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "travel_expenses" ADD CONSTRAINT "travel_expenses_trip_id_fkey"
  FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "travel_expenses_user_id_paid_on_idx" ON "travel_expenses" ("user_id", "paid_on");
CREATE INDEX "travel_expenses_user_id_trip_id_idx" ON "travel_expenses" ("user_id", "trip_id");

-- FREEZE: nothing changes once kept, except the void — voided_at and void_reason, set together, once, from NULL.
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

CREATE TRIGGER protect_travel_expense_fields
BEFORE UPDATE ON "travel_expenses"
FOR EACH ROW
EXECUTE FUNCTION prevent_travel_expense_mutation();

-- NO DELETE: a kept expense is never removed — void it instead.
CREATE OR REPLACE FUNCTION prevent_travel_expense_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Travel expenses cannot be deleted. Void one instead — the voided expense stays, with its reason.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_travel_expense_deletes
BEFORE DELETE ON "travel_expenses"
FOR EACH ROW
EXECUTE FUNCTION prevent_travel_expense_delete();

CREATE TRIGGER no_travel_expense_truncate
BEFORE TRUNCATE ON "travel_expenses"
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_travel_expense_delete();

-- THE SIXTH KIND (ruling B). The LINES-01 idiom: drop the kind CHECK, re-add it with the kind.
ALTER TABLE "planned_item_links" DROP CONSTRAINT IF EXISTS "planned_item_links_kind";
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_kind"
  CHECK ("target_kind" IN ('calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item', 'travel_expense'));
