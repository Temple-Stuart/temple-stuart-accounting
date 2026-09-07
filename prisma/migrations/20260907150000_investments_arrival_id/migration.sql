-- REBUILD-01 PR-2c: investment_transactions.arrival_id and securities.arrival_id —
-- the domain row points at the arrival it was parsed from (src/lib/arrivals/
-- plaidInvestmentsPage.ts; the one Plaid writer, src/app/api/transactions/
-- sync-complete/route.ts, investments phase). NULL for every row synced before
-- this landed: the documented cutoff — no synthetic backfill (the PR-2 posture
-- for transactions.arrival_id, 20260903120000_arrival_id_and_correction_key).
--
-- ADDITIVE-ONLY: two nullable columns, two FKs, two indexes. Zero data rewrites.
-- Applied by `prisma migrate deploy` at deploy (schema.prisma moves with it);
-- no hand run.
--
-- FK posture: NO ACTION — an arrival is kept forever (PR-1), so a linked
-- arrival can never be deleted from under its domain row. Names follow
-- Prisma's default (<table>_<col>_fkey / _idx).

ALTER TABLE investment_transactions ADD COLUMN arrival_id text NULL REFERENCES arrivals(id);

CREATE INDEX investment_transactions_arrival_id_idx ON investment_transactions (arrival_id);

ALTER TABLE securities ADD COLUMN arrival_id text NULL REFERENCES arrivals(id);

CREATE INDEX securities_arrival_id_idx ON securities (arrival_id);
