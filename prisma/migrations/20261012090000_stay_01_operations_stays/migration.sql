-- STAY-01 (2026-10-12) — THE STAY: where the user is, from a first day to a last day.
--
-- "Chiang Mai, Oct 20 → Nov 2" · "Los Angeles, Nov 3 → Feb 2". A stay is a span of
-- calendar DAYS (@db.Date), inclusive at both ends, wherever the user is — never an
-- instant, never a zone. The day card reads the stay covering its day for
-- "DAY n OF m" and the place.
--
-- HELD HERE, NOT BY CONVENTION: a place that is not blank (STEP 1 CHECK); a last day
-- on or after the first (STEP 1 CHECK); and ONE USER'S STAYS NEVER OVERLAP — a trigger
-- (STEP 2) that locks the user's own row FOR NO KEY UPDATE before it reads, so two
-- concurrent writes for one user cannot both pass, then refuses any row whose days
-- meet another stay's. FOR NO KEY UPDATE, not FOR UPDATE: it serialises stay writes
-- for one user and does not block the FOR KEY SHARE a foreign-key check takes on
-- that row. Its message starts with the fixed tag STAY_OVERLAP, which the writing
-- routes recognise (src/lib/operations/stay.ts OVERLAP_TAG). The route refuses an
-- overlap by name before any write; the trigger is the backstop for the race.
--
-- onDelete: a deleted user's stays go with them (CASCADE).
--
-- The two AuditActionType values name a set (created or changed) and a delete
-- (STEP 3), added the LINK-02 way. A new enum value cannot be USED in the
-- transaction that added it; nothing here uses them.
--
-- AUTHORED here, applied at deploy (package.json:11 runs prisma migrate deploy
-- before next build). NO BACKFILL: no stay existed before this table.

-- STEP 1 — the table.
CREATE TABLE "operations_stays" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    TEXT         NOT NULL,
  "place"      VARCHAR(80)  NOT NULL,
  "starts_on"  DATE         NOT NULL,
  "ends_on"    DATE         NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "operations_stays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "operations_stays_place_not_blank" CHECK (length(btrim("place")) > 0),
  CONSTRAINT "operations_stays_days_ordered" CHECK ("ends_on" >= "starts_on")
);

ALTER TABLE "operations_stays"
  ADD CONSTRAINT "operations_stays_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "operations_stays_user_id_starts_on_idx" ON "operations_stays"("user_id", "starts_on");

-- STEP 2 — one user's stays never overlap: lock the user's row, then look.
CREATE OR REPLACE FUNCTION operations_stays_no_overlap() RETURNS trigger AS $$
DECLARE
  other RECORD;
BEGIN
  -- Serialise this user's stay writes: two concurrent inserts for one user queue here.
  PERFORM 1 FROM "users" WHERE "id" = NEW."user_id" FOR NO KEY UPDATE;
  SELECT "id", "place", "starts_on", "ends_on" INTO other
    FROM "operations_stays"
   WHERE "user_id" = NEW."user_id"
     AND "id" <> NEW."id"
     AND "starts_on" <= NEW."ends_on"
     AND "ends_on" >= NEW."starts_on"
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'STAY_OVERLAP: % to % meets the stay "%" (% to %, id %)',
      NEW."starts_on", NEW."ends_on", other."place", other."starts_on", other."ends_on", other."id"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "operations_stays_no_overlap"
  BEFORE INSERT OR UPDATE OF "starts_on", "ends_on", "user_id" ON "operations_stays"
  FOR EACH ROW EXECUTE FUNCTION operations_stays_no_overlap();

-- STEP 3 — the audit vocabulary.
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stay_set';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'operations_stay_deleted';
