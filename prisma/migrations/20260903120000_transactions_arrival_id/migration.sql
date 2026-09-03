-- REBUILD-01 PR-2: transactions.arrival_id — the domain row points at the
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
