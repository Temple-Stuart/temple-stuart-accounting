-- TRADE-COST-01 — SLOW DATA IS FETCHED ONCE: the per-symbol Finnhub cache.
--
-- One scan of the S&P 500 is ~500 symbols × 26 metered Finnhub calls. Of the
-- 26, eighteen return data that moves quarterly (filings), weekly (analyst
-- consensus) or monthly (13F / Form 4) — and every scan refetched all of them.
-- This table holds ONE row per (symbol, endpoint, params hash): the vendor's
-- verbatim JSON answer, its HTTP status and fetched_at. The cache helper
-- (src/lib/convergence/finnhub-cache.ts) serves a row inside its endpoint's TTL
-- (src/lib/convergence/finnhub-ttl.ts: 7 days quarterly, 24 hours weekly and
-- monthly, NO cache for the daily tier) and OVERWRITES it on refetch. Nothing
-- is ever presented as fresher than it is: fetched_at rides with every value.
--
-- NO user column — market data is not user-scoped; one answer serves every
-- scan. key_params is the spec that was hashed (a window computed from today is
-- keyed relatively, e.g. from=-540d); sent_params is the absolute query the
-- vendor actually saw, so fetched_at + window are reconstructible.
--
-- Applied by `prisma migrate deploy` at deploy after merge (the Routine cannot
-- reach Azure). No data is moved; nothing reads this table before this PR.
CREATE TABLE "finnhub_responses" (
    "symbol" VARCHAR(20) NOT NULL,
    "endpoint" VARCHAR(64) NOT NULL,
    "params_hash" VARCHAR(64) NOT NULL,
    "key_params" VARCHAR(512) NOT NULL,
    "sent_params" VARCHAR(512) NOT NULL,
    "response" JSONB NOT NULL,
    "vendor_status" INTEGER NOT NULL,
    "fetched_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "finnhub_responses_pkey" PRIMARY KEY ("symbol","endpoint","params_hash")
);

CREATE INDEX "finnhub_responses_fetched_at_idx" ON "finnhub_responses"("fetched_at");
