-- MODEL-01 — TWO SCORES, ONE CATALYST GATE, AND EVERY NUMBER LABELLED FOR
-- WHAT IT IS.
--
-- The scanner scored both premium directions with one seller-shaped score.
-- From this migration on every scan run records the mode it ran in and every
-- candidate row records the side it came through, the model that scored it
-- (seller = today's composite renamed; buyer = the recomposition per the
-- input-sign table), its catalysts (non-empty on every BUY row — a buy-side
-- candidate does not exist without one), the earnings date against its
-- window, and the per-user cap check that let an unbounded structure exist.
-- EDGE-01's third book buckets by side from these columns.
--
-- Backfill: every row written before MODEL-01 came through the seller-only
-- funnel (pipeline.ts Step C excluded IV <= HV) and was scored by the
-- composite that sellerScore() now IS — so side 'SELL' / score_model 'seller'
-- is what happened, not a guess. The defaults used for the backfill are then
-- DROPPED: a new row must state its side, model and window.
--
-- Applied by `prisma migrate deploy` at deploy after merge (the Routine cannot
-- reach Azure). No data is moved.
ALTER TABLE "scan_runs" ADD COLUMN "side" VARCHAR(4) NOT NULL DEFAULT 'SELL';
ALTER TABLE "scan_runs" ALTER COLUMN "side" DROP DEFAULT;

ALTER TABLE "scan_candidates" ADD COLUMN "side" VARCHAR(4) NOT NULL DEFAULT 'SELL';
ALTER TABLE "scan_candidates" ADD COLUMN "score_model" VARCHAR(8) NOT NULL DEFAULT 'seller';
ALTER TABLE "scan_candidates" ADD COLUMN "catalyst" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "scan_candidates" ADD COLUMN "earnings_window" TEXT NOT NULL DEFAULT 'not evaluated — row written before MODEL-01';
ALTER TABLE "scan_candidates" ADD COLUMN "undefined_risk_cap" TEXT;
ALTER TABLE "scan_candidates" ALTER COLUMN "side" DROP DEFAULT;
ALTER TABLE "scan_candidates" ALTER COLUMN "score_model" DROP DEFAULT;
ALTER TABLE "scan_candidates" ALTER COLUMN "earnings_window" DROP DEFAULT;

CREATE INDEX "scan_candidates_side_generated_at_idx" ON "scan_candidates"("side", "generated_at");
