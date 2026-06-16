-- PR-Flight-Duration-1-Capture — store the flight's TRUE elapsed duration.
--
-- Cross-timezone flights (e.g. LAX 00:00 → Bali 10:05 next day) render as a ~34h block
-- because the calendar reconstructs the span from two naive, zone-less local times. Duffel
-- already gives us the real elapsed time (slice.duration, e.g. PT19H5M → 1145 min); we now
-- capture it. PR-2 renders the block as depart-time + this duration (true 19h05m).
--
-- Additive + nullable: flights only. Hotels, manual lines, and pre-existing rows stay NULL
-- (they keep the current render until re-committed). Run BEFORE merging the code.

ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
ALTER TABLE trip_itinerary  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER;
