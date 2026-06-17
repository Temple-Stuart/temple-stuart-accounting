-- PR-tz-1 — timezone storage: home-anchor instant + IANA zones.
--
-- Additive + nullable. start_zone/end_zone hold the departure/arrival airport IANA zones
-- (Duffel Airport.time_zone, e.g. 'America/Los_Angeles' / 'Asia/Makassar') — persisted as
-- passthrough from this PR on. start_at/end_at hold the TRUE UTC instant anchor — staged
-- NULL for now; populated by a post-tz-2 PR via the canonical converter (lib/time.ts).
--
-- Old rows + non-flight events stay NULL (no backfill — there is no stored zone to derive
-- an instant from). The existing naive date/time columns are untouched. Run BEFORE merge.

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS start_at   timestamptz,
  ADD COLUMN IF NOT EXISTS end_at     timestamptz,
  ADD COLUMN IF NOT EXISTS start_zone text,
  ADD COLUMN IF NOT EXISTS end_zone   text;

ALTER TABLE trip_itinerary
  ADD COLUMN IF NOT EXISTS start_at   timestamptz,
  ADD COLUMN IF NOT EXISTS end_at     timestamptz,
  ADD COLUMN IF NOT EXISTS start_zone text,
  ADD COLUMN IF NOT EXISTS end_zone   text;
