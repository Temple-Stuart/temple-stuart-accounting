# MIG-1 Audit — nullable gate-score snapshot columns (honest null for fully-excluded gates)

**Date:** 2026-07-06 · **Branch:** `claude/mig-1-nullable-gate-scores` · **Base:** main @ `8156da74` (KILL-7 `0b0effd1` verified present)

## ⚠️ ALEX MUST RUN THE ALTER SQL VIA psql BEFORE MERGING THIS PR

The Prisma client shipped in this PR types the five gate-score columns as nullable and the
writer records real nulls. If the PR deploys before the columns accept NULL, the first
fully-excluded gate will fail the snapshot insert at the DB (NOT NULL violation). Migration
BEFORE merge, per the locked learning. CC did not and cannot run any migration.

```sql
-- MIG-1: scan_snapshots gate scores → nullable.
-- Idempotent: DROP NOT NULL on an already-nullable column is a no-op in Postgres
-- (safe to re-run). Run via psql against Azure Postgres.
ALTER TABLE scan_snapshots ALTER COLUMN "volEdgeScore"   DROP NOT NULL;
ALTER TABLE scan_snapshots ALTER COLUMN "qualityScore"   DROP NOT NULL;
ALTER TABLE scan_snapshots ALTER COLUMN "regimeScore"    DROP NOT NULL;
ALTER TABLE scan_snapshots ALTER COLUMN "infoEdgeScore"  DROP NOT NULL;
ALTER TABLE scan_snapshots ALTER COLUMN "compositeScore" DROP NOT NULL;

-- Verify:
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'scan_snapshots'
  AND column_name IN ('volEdgeScore','qualityScore','regimeScore','infoEdgeScore','compositeScore');
```

## Phase 1 findings (read-only, on base)

- The five non-nullable columns: `prisma/schema.prisma` scan_snapshots — `volEdgeScore Float`,
  `qualityScore Float`, `regimeScore Float`, `infoEdgeScore Float`, `compositeScore Float`
  (base :1777-:1781). All other numeric snapshot fields were already `Float?`/`Int?`.
- Pre-MIG-1 the write path could never produce a null: KILL-3/5/6 left **fail-loud throws**
  in each gate for the zero-computable-signals case (vol-edge ~:1189, quality-gate, info-edge
  :1304-era, regime), each carrying a "gate exclusion is a migration" flag — the throws were
  the placeholder this migration removes.
- The composite writer did NOT renormalize over present gates (gate scores were typed
  `number`); this PR converts it (see below).

## What changed (writer path)

| File | Change |
|---|---|
| `prisma/schema.prisma` + `npx prisma generate` | 5 columns → `Float?` (same PR as the ALTER, per migration discipline) |
| `src/lib/convergence/types.ts` | `score: number \| null` on VolEdge/Quality/Regime/InfoEdge/Composite results; `RegimeResult.breakdown.regime_scores`/`dominant_regime` nullable; `CompositeResult.category_scores` nullable; `TradeCardWhy.composite_score` nullable |
| `vol-edge.ts` / `quality-gate.ts` / `info-edge.ts` | KILL-era throw → gate score flows the combiner's null (exclusions already declared in `excluded_fields` + N/M) |
| `regime.ts` | throw → full honest excluded RegimeResult: `score: null`, `regime_scores: null`, `dominant_regime: null`, `best_strategy: 'NOT COMPUTABLE — …'`, same excluded-fields accounting as the scored path (:718-:730 mirrored at :580-:593), ancillary signals preserved |
| `composite.ts` | composite = `combineWeighted` over the four gates (null gates excluded, weights renormalized — the EDGE-2 combiner, same as inside every gate); all-four-null → composite null; excluded regime → static gate weights; `data_gaps` gets `gate_excluded: <gate> — zero computable signals; recorded as null in scan_snapshots, composite renormalized over the present gates`; direction `UNKNOWN (info-edge excluded — no signal data)` when info-edge null; confidence aggregation now merges **excluded_fields too** and uses the per-gate convention `confidence = active/total` (post-KILL-3, aggregating only `imputed_fields` had silently pinned snapshot `dataConfidence`/`imputedCount` at full) |
| `composite.ts` deriveStrategy | null regime → `'Regime gate EXCLUDED … defined risk preferred by default, not scored'`; null vol-edge → `suggested_strategy: 'NOT COMPUTABLE — …'`; direction UNKNOWN → `'NOT COMPUTABLE — direction unknown (info-edge gate excluded)'` (previously UNKNOWN would have fallen into the BEARISH else-branch — latent bug, fixed) |
| `snapshot-logger.ts` | unchanged — it already writes `scoring.*.score` verbatim; with nullable columns the null lands in the row |

## Readers made null-safe ('—', no coercion)

- `pipeline.ts`: `RankedRow` gate fields → `number | null`; ranking sort puts null composite
  LAST (no score ≠ low score); `selection_status: 'not_scored — all gates excluded'`;
  excluded-reason + eligibility filter: **a null quality gate does NOT pass the 40-floor**
  ("missing is not treated as passing" — declared in adjustments), it is excluded with reason.
- `trade-cards.ts`: `letterGrade(null)` → `'— (not scored — all gates excluded)'` (never an F
  for missing data); quality signal line declares the exclusion; `regimeContext` returns
  `'Macro regime NOT COMPUTABLE — regime gate excluded…'` when unclassified.
- `ConvergenceIntelligence.tsx`: rankings table renders `'—'` (with an "excluded" tooltip) for
  null gate cells, gates-above-50 counts nulls as not-above, status row shows
  `'✗ Not scored — all gates excluded'`; regime-panel `domExplain[dom]` guarded (panel itself
  already gated on `regime_scores` present).
- Only two files touch `prisma.scan_snapshots`: `snapshot-logger.ts` (writes; VRP history reads
  only iv30/hv30, already null-filtered) and `outcome-tracker.ts` (reads no gate columns) —
  no other DB readers exist.

## Executed traces

1. **FRED all-null, vol/quality present** → `regime.score: null`, `info_edge.score: null`
   (fixture has no info signals), `data_gaps` carries both `gate_excluded:` declarations,
   composite **73.7 = (74.3 + 73)/2** — renormalized over the two present gates at equal
   static weights (regime excluded → `static_fallback` weight mode). Snapshot write values:
   `volEdgeScore 74.3, qualityScore 73, regimeScore null, infoEdgeScore null, compositeScore 73.7`.
2. **Zero-data ticker** → all four gates null, `compositeScore: null`, convergence `0/4 → NO
   TRADE`, `position_size_pct: 0`, direction `UNKNOWN (info-edge excluded…)`,
   strategy `NOT COMPUTABLE — vol-edge gate excluded…`, all four `gate_excluded:` gaps,
   confidence **0** with `active/total 0/55` (coherent with the per-gate 0s).

## Verification

Tripwire on added lines: three hits, all cited — regime.ts `growth.score ?? 0` /
`inflation.score ?? 0` are the established KILL-3 EXCLUDED-trace display shape (trace score 0
with `active_signal_count: 0`; the gate score itself is null and nothing aggregates the 0s);
trade-cards.ts `regime_scores[dom] ?? 0` is the pre-existing lookup-miss guard, moved below
the new null guard unchanged. No value defaults added. `tsc` exit 0; `next build` compiled
successfully + types valid (standing sandbox limit: page-data collection fails on
/api/admin/backfill-transaction-fields for missing PLAID_CLIENT_ID/PLAID_SECRET — unrelated).
No route/auth changes, nothing in PUBLIC_PATHS. No migration was run by CC.
