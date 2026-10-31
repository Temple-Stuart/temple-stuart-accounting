-- ONEOFF-01 — A ONE-OFF IS A ROUTINE THAT HAPPENS ONCE, AUTHORED IN TASKS.
--
-- A one-off is a routine with cadence "once": an RRULE of FREQ=DAILY;COUNT=1
-- anchored on the routine's own start_date, so every reader expands it to
-- exactly one occurrence, on that date, and never again. Its lines (LINES-01)
-- already carry amount and account. What a routine did NOT hold was a PLACE —
-- the calendar's hand-entered event had one (calendar_events.location /
-- latitude / longitude, GEO-01) and the routine had none. It holds one now, at
-- the routine level, so the occurrence pins on the day map like the event it
-- replaces.
--
-- AUTHORED, NOT APPLIED. Claude Code cannot reach Azure Postgres; Alex runs this
-- via psql, or it applies at deploy after merge.

-- STEP 1: the routine carries its place. All three NULLABLE — a routine with no
-- place has no place, and no coordinate is ever written as 0,0. The types match
-- calendar_events (VARCHAR(255), DECIMAL(10,7)) so a pin means the same thing on
-- both rows.
ALTER TABLE "operations_routines" ADD COLUMN "location"  VARCHAR(255);
ALTER TABLE "operations_routines" ADD COLUMN "latitude"  DECIMAL(10,7);
ALTER TABLE "operations_routines" ADD COLUMN "longitude" DECIMAL(10,7);

-- STEP 2: half a pair is not a place. A CHECK, not a convention — the same
-- all-or-nothing rule the event builder enforced in code (manualEvent.ts).
ALTER TABLE "operations_routines" ADD CONSTRAINT "operations_routines_place_pair"
  CHECK (("latitude" IS NULL) = ("longitude" IS NULL));

-- STEP 3: a one-off has its date. COUNT=1 is anchored on start_date; without one
-- the rule would expand against the fixed 1971 anchor and the occurrence would
-- fall in 1971, invisible to every reader. The database refuses that row.
ALTER TABLE "operations_routines" ADD CONSTRAINT "operations_routines_once_has_date"
  CHECK ("schedule_rrule" !~ '(^|;)COUNT=1(;|$)' OR "start_date" IS NOT NULL);

-- STEP 4: NOTHING MOVES. No calendar_events row is migrated into a routine, no
-- row is deleted, no link is touched. An event entered by hand before this
-- ruling stays the calendar's own row: it renders, and its owner corrects or
-- removes it from the day. A new one-off is authored in Tasks from now on.
