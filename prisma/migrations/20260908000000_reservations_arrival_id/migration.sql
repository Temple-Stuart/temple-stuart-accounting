-- REBUILD-01 PR-5: reservations.arrival_id — the booking row points at the
-- LiteAPI book answer it was parsed from (src/lib/arrivals/liteapiBooking.ts;
-- the two book routes, src/app/api/travel/liteapi/book/route.ts and
-- liteapi/flights/book/route.ts, write it inside the landing's transaction).
-- NULL for every row recorded before this landed: the documented cutoff — no
-- synthetic backfill (the PR-2 posture for transactions.arrival_id,
-- 20260903120000_arrival_id_and_correction_key). Rows written with provider
-- 'duffel' stay NULL: a provider the deck does not name, not landed.
--
-- ADDITIVE-ONLY: one nullable column, one FK, one index. Zero data rewrites.
-- Applied by `prisma migrate deploy` at deploy (schema.prisma moves with it);
-- no hand run.
--
-- FK posture: NO ACTION — an arrival is kept forever (PR-1), so a linked
-- arrival can never be deleted from under its booking row. Names follow
-- Prisma's default (<table>_<col>_fkey / _idx).
--
-- The event kind view (20260907200000_kind_views) still reads NULL::text for
-- bookings' arrival_id — a view is redefined by a migration of its own
-- (src/lib/kindViews.ts KIND_VIEW_CENSUS names it); not this one.

ALTER TABLE reservations ADD COLUMN arrival_id text NULL REFERENCES arrivals(id);

CREATE INDEX reservations_arrival_id_idx ON reservations (arrival_id);
