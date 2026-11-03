-- TRAVEL-02c (Alex, 2026-11-03, rulings A and B) — A STAY'S COST PER DAY AGAINST THE LA BASELINE.
--
-- A. THE SEVENTH KIND. TRAVEL-00's decision 8, CHANGED (Alex + chat, 2026-11-03): not a booking→stay column on
-- reservations, but any charge — a posting — linked by hand to the stay it paid for, through the one link rule. A
-- hotel or a flight booked in the app and one booked elsewhere and paid by card alike. planned_item_links gains a
-- seventh kind, 'stay' (the target_id is operations_stays.id). The kind CHECK TRAVEL-02b wrote
-- (20261103120000_travel_02b_travel_expenses) is rewritten with it — the 02b idiom: drop it, re-add it. The instant
-- CHECK LINES-01 wrote is untouched: it already forbids an instant for every kind but routine and routine_line, so a
-- 'stay' link carries none — the link is to the stay, not to its dates. Nothing is migrated; no link is created.
--
-- B. THE BASELINE TABLE (TRAVEL-00's decision 9, standing). living_baselines: one user's dated, frozen statement of
-- what living at home costs a month — 'LA rent', from a day, a monthly figure in HUNDREDTHS of its currency (the travel
-- lane's declared convention, travelExpense.ts THE HUNDREDTHS), stated in ISO 4217 with NO default (FX-01). The row in
-- force on a day is the live row with the latest effective_from on or before that day.
--
-- APPEND-ONLY, HELD HERE — not by convention (the travel_expenses precedent):
--   · FREEZE: every UPDATE is refused, except the void — voided_at and void_reason set together, ONCE, from NULL, with
--     every other column unchanged;
--   · NO DELETE: every DELETE is refused, and a TRUNCATE with it — a voided baseline stays, with its reason;
--   · ONE LIVE BASELINE A DAY: a partial unique index — two live baselines never start the same day (a voided one
--     leaves its day free).
--
-- AUTHORED, NOT APPLIED to any shared database. Claude Code cannot reach Azure Postgres. It applies at the production
-- deploy after the merge, through the build's migration gate (PREVIEW-DB-01: a preview never migrates).

CREATE TABLE "living_baselines" (
  "id"             UUID           NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        TEXT           NOT NULL,
  "label"          VARCHAR(80)    NOT NULL,
  "effective_from" DATE           NOT NULL,
  "monthly_minor"  INTEGER        NOT NULL,
  "currency"       VARCHAR(3)     NOT NULL,
  "voided_at"      TIMESTAMPTZ(6),
  "void_reason"    TEXT,
  "created_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "created_by"     TEXT           NOT NULL,

  CONSTRAINT "living_baselines_pkey" PRIMARY KEY ("id")
);

-- The label as typed, trimmed: 1 to 80 characters (STAY-01's rule for a place).
ALTER TABLE "living_baselines" ADD CONSTRAINT "living_baselines_label_not_blank"
  CHECK (char_length(btrim("label")) BETWEEN 1 AND 80);

ALTER TABLE "living_baselines" ADD CONSTRAINT "living_baselines_monthly_positive"
  CHECK ("monthly_minor" > 0);

ALTER TABLE "living_baselines" ADD CONSTRAINT "living_baselines_currency_three"
  CHECK (char_length("currency") = 3);

-- Voided is both columns or neither, and the reason is never blank.
ALTER TABLE "living_baselines" ADD CONSTRAINT "living_baselines_void_pair"
  CHECK (("voided_at" IS NULL AND "void_reason" IS NULL)
      OR ("voided_at" IS NOT NULL AND "void_reason" IS NOT NULL AND char_length(btrim("void_reason")) > 0));

ALTER TABLE "living_baselines" ADD CONSTRAINT "living_baselines_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "living_baselines_user_id_effective_from_idx" ON "living_baselines" ("user_id", "effective_from");

-- Two live baselines never start the same day; a voided one leaves its day free.
CREATE UNIQUE INDEX "living_baselines_one_live_per_day" ON "living_baselines" ("user_id", "effective_from")
  WHERE "voided_at" IS NULL;

-- FREEZE: nothing changes once kept, except the void — voided_at and void_reason, set together, once, from NULL.
CREATE OR REPLACE FUNCTION prevent_living_baseline_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.label IS DISTINCT FROM OLD.label
     OR NEW.effective_from IS DISTINCT FROM OLD.effective_from
     OR NEW.monthly_minor IS DISTINCT FROM OLD.monthly_minor
     OR NEW.currency IS DISTINCT FROM OLD.currency
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION 'A living baseline cannot be changed once kept. Only voided_at and void_reason may be set, once, when it is voided.';
  END IF;
  IF OLD.voided_at IS NOT NULL OR OLD.void_reason IS NOT NULL THEN
    RAISE EXCEPTION 'A living baseline is voided once: voided_at and void_reason cannot change or go back to NULL.';
  END IF;
  IF NEW.voided_at IS NULL OR NEW.void_reason IS NULL THEN
    RAISE EXCEPTION 'The one change a living baseline takes is its void: voided_at and void_reason, set together.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_living_baseline_fields
BEFORE UPDATE ON "living_baselines"
FOR EACH ROW
EXECUTE FUNCTION prevent_living_baseline_mutation();

-- NO DELETE: a kept baseline is never removed — void it instead.
CREATE OR REPLACE FUNCTION prevent_living_baseline_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Living baselines cannot be deleted. Void one instead — the voided baseline stays, with its reason.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER no_living_baseline_deletes
BEFORE DELETE ON "living_baselines"
FOR EACH ROW
EXECUTE FUNCTION prevent_living_baseline_delete();

CREATE TRIGGER no_living_baseline_truncate
BEFORE TRUNCATE ON "living_baselines"
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_living_baseline_delete();

-- A. THE SEVENTH KIND (ruling A). The 02b idiom: drop the kind CHECK, re-add it with the kind.
ALTER TABLE "planned_item_links" DROP CONSTRAINT IF EXISTS "planned_item_links_kind";
ALTER TABLE "planned_item_links" ADD CONSTRAINT "planned_item_links_kind"
  CHECK ("target_kind" IN ('calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item', 'travel_expense', 'stay'));
