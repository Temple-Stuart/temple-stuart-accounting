-- LOG-01 — EVERY SCANNED CANDIDATE IS LOGGED, TAKEN OR NOT: the clock on edge
-- starts now.
--
-- EDGE-01 measured the scanner against the founder's picks: 7 graded trades
-- in the product's life, none scored under the current composite. The scanner
-- scores candidate structures on every run and throws every one away that
-- the founder does not take. From this migration on, every scored candidate
-- persists with its scores LOCKED at scan time (scan_candidates, keyed by a
-- scan_runs row that is keyed by the user), and its outcome is tracked to
-- expiry whether or not it was traded — the model is measured against the
-- market, not against the founder's picks (the research's second fix for
-- selection bias).
--
-- trade_cards.candidate_id ties a saved card back to the candidate it came
-- from; the link route flips scan_candidates.taken on link/unlink, and the
-- settle (src/lib/convergence/candidate-log.ts) writes outcome_pl from the
-- linked position for a taken candidate and from the free TastyTrade daily
-- close at expiry for an untaken one — outcome_source says which. A price
-- that cannot be obtained leaves outcome_pl NULL with outcome_reason.
--
-- Applied by `prisma migrate deploy` at deploy after merge (the Routine
-- cannot reach Azure). No data is moved. trade_cards exists on the deploy
-- target (it was created outside the migration history — see the PR audit).
CREATE TABLE "scan_runs" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "universe" VARCHAR(40),
    "limit_requested" INTEGER NOT NULL,
    "model_era" VARCHAR(8) NOT NULL,
    "tickers_scored" INTEGER NOT NULL,
    "candidates_written" INTEGER NOT NULL,

    CONSTRAINT "scan_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scan_runs_userId_started_at_idx" ON "scan_runs"("userId", "started_at");

ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "scan_candidates" (
    "id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "strategy_name" TEXT NOT NULL,
    "label" VARCHAR(8),
    "legs" JSONB NOT NULL,
    "expiration" DATE NOT NULL,
    "dte" INTEGER NOT NULL,
    "net_credit" DOUBLE PRECISION,
    "net_debit" DOUBLE PRECISION,
    "max_profit" DOUBLE PRECISION,
    "max_loss" DOUBLE PRECISION,
    "is_unlimited" BOOLEAN NOT NULL,
    "pop" DOUBLE PRECISION,
    "pop_method" VARCHAR(20),
    "ev" DOUBLE PRECISION,
    "ev_per_risk" DOUBLE PRECISION,
    "spot_at_scan" DOUBLE PRECISION,
    "iv30_at_scan" DOUBLE PRECISION,
    "composite_score" DOUBLE PRECISION,
    "vol_edge_score" DOUBLE PRECISION,
    "quality_score" DOUBLE PRECISION,
    "regime_score" DOUBLE PRECISION,
    "info_edge_score" DOUBLE PRECISION,
    "data_confidence" DOUBLE PRECISION,
    "imputed_count" INTEGER,
    "excluded_fields" JSONB NOT NULL,
    "model_era" VARCHAR(8) NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL,
    "taken" BOOLEAN NOT NULL DEFAULT false,
    "outcome_pl" DOUBLE PRECISION,
    "outcome_at" TIMESTAMPTZ(6),
    "outcome_source" VARCHAR(120),
    "outcome_reason" TEXT,
    "settle_price" DOUBLE PRECISION,
    "settle_price_date" DATE,

    CONSTRAINT "scan_candidates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "scan_candidates_run_id_idx" ON "scan_candidates"("run_id");
CREATE INDEX "scan_candidates_expiration_outcome_at_idx" ON "scan_candidates"("expiration", "outcome_at");
CREATE INDEX "scan_candidates_symbol_generated_at_idx" ON "scan_candidates"("symbol", "generated_at");

ALTER TABLE "scan_candidates" ADD CONSTRAINT "scan_candidates_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "trade_cards" ADD COLUMN "candidate_id" UUID;

CREATE INDEX "trade_cards_candidate_id_idx" ON "trade_cards"("candidate_id");

ALTER TABLE "trade_cards" ADD CONSTRAINT "trade_cards_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "scan_candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
