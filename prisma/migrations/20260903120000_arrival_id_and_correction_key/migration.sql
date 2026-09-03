-- REBUILD-01 PR-2: (1) transactions.arrival_id — the domain row points at the
-- arrival it was parsed from (src/lib/arrivals/land.ts; the one Plaid writer,
-- src/app/api/transactions/sync-complete/route.ts). NULL for every row synced
-- before arrivals landed: the documented cutoff — no synthetic backfill.
--
-- ADDITIVE-ONLY: one nullable column, one FK, one index. Zero data rewrites.
-- Applied by `prisma migrate deploy` at deploy (schema.prisma moves with it);
-- no hand run.
--
-- FK posture: NO ACTION — an arrival is kept forever (PR-1), so a linked
-- arrival can never be deleted from under its transaction. Name follows
-- Prisma's default (<table>_<col>_fkey / _idx).

ALTER TABLE transactions ADD COLUMN arrival_id text NULL REFERENCES arrivals(id);

CREATE INDEX transactions_arrival_id_idx ON transactions (arrival_id);

-- PR-2 fix-up: CORRECTIONS ARE NEW ROWS. PR-1's UNIQUE (provider, their_id)
-- treated a provider's correction as a duplicate and left the domain row on
-- its first parse — a regression against main's upsert and a break of promise
-- 1 ("if a provider corrects something, the correction is a new row"). The
-- same thing is the same provider + their_id + fingerprint (sha256 of the
-- payload's RFC 8785 bytes); a changed payload is a new arrival. PR-1's key
-- is live in Azure; this swaps it in place.

ALTER TABLE arrivals DROP CONSTRAINT arrivals_provider_their_id_key;

ALTER TABLE arrivals
    ADD CONSTRAINT arrivals_provider_their_id_fingerprint_key
    UNIQUE (provider, their_id, fingerprint);

-- "latest for this id": the newest arrival of a provider object.
CREATE INDEX arrivals_provider_their_id_arrived_idx
    ON arrivals (provider, their_id, arrived DESC);
