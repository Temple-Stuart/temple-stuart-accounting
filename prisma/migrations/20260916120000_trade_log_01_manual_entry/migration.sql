-- TRADE-LOG-01 — a trade can be logged by hand.
--
-- WHY THIS COLUMN EXISTS. trading_positions had no owner of its own. Every
-- reader scoped a user's rows through the arrivals chain —
-- open_investment_txn_id → investment_transactions.accountId → accounts.userId
-- (src/app/api/trading/route.ts:68-80, trades/route.ts:49-53,
-- trading-positions/open/route.ts:26-30, coverage/route.ts:53-56,
-- positions/summary/route.ts:31-34, trade-card-links/route.ts:62-64,
-- convergence/undefined-risk.prisma.ts:20-25). A hand-entered trade has NO
-- investment_transactions leg, so under that chain it would be both unowned and
-- invisible. `userId` gives such a row an owner directly.
--
-- NULLABLE, and deliberately NOT backfilled. Every row written before this
-- migration resolves through the chain exactly as it did; nothing about them
-- changes. Backfilling would be a write across user financial records for no
-- gain, and the constitution forbids rewriting those without explicit approval.
-- The one predicate that reads both shapes is src/lib/tradeLog/ownership.ts.
--
-- open_investment_txn_id BECOMES NULLABLE. A hand-entered row has no arrival
-- behind it; a synthetic id would claim an investment transaction that does not
-- exist. Null states the truth. Every synced row keeps its leg's id, and the
-- NOT NULL constraint is the only thing dropped — no value is touched.
--
-- `source` IS NOT ADDED: it already exists (VarChar(20), NOT NULL, DEFAULT
-- 'legacy') and is tax-significant — src/lib/tax-report-service.ts:50-55 treats
-- plaid/tastytrade/robinhood/legacy as broker-imported (Form 8949 Box A/D) and
-- anything else as self-reported (Box B/E). Hand-entered rows are written with
-- source='manual', which correctly lands them in Box B/E. Existing rows are NOT
-- rebranded: 'legacy' already means broker-imported there, the authoritative
-- source is resolved per position from the opening account
-- (tax-report-service.ts:295-300, :345-349), and overwriting it would destroy
-- that distinction and rewrite user financial data.
--
-- Authored 2026-09-16; applied by `prisma migrate deploy` at deploy after merge.

ALTER TABLE "trading_positions" ADD COLUMN "userId" VARCHAR(255);
ALTER TABLE "trading_positions" ALTER COLUMN "open_investment_txn_id" DROP NOT NULL;

CREATE INDEX "trading_positions_userId_idx" ON "trading_positions"("userId");
CREATE INDEX "trading_positions_userId_source_idx" ON "trading_positions"("userId", "source");
