/**
 * EDGE-01 — the model-version eras. A card scored under an old model is not
 * comparable to one scored under the new, so the read buckets by era.
 *
 * Boundaries are the MERGE dates on main (UTC) of every commit that changed
 * composite weights, gate thresholds, an input, or the card/PoP builder —
 * from `git log` over composite.ts, quality-gate.ts, vol-edge.ts,
 * info-edge.ts, regime.ts, pipeline.ts, data-fetchers.ts and
 * strategy-builder.ts (read 2026-09-15). The Vercel deploy time of each merge
 * is not recorded in the repo; a card generated within hours of a boundary
 * may sit on either side — the counts say how many are that close.
 */
export interface ModelEra {
  id: string;
  /** Inclusive start, ISO date, UTC. */
  from: string;
  label: string;
  change: string;
  commits: string;
}

export const MODEL_ERAS: readonly ModelEra[] = [
  {
    id: 'E0',
    from: '0000-01-01',
    label: 'pre-#1082',
    change: 'no convergence composite existed — composite.ts, quality-gate.ts, vol-edge.ts, info-edge.ts and regime.ts first land in #1082; a card from this era cannot carry a composite_score from the current model',
    commits: '—',
  },
  {
    id: 'E1',
    from: '2026-06-20',
    label: '#1082 regime-weighted composite',
    change: 'STATIC_WEIGHTS 0.25×4 and REGIME_WEIGHT_TABLE (composite.ts:28-43); the six hard filters and the pre-score (pipeline.ts:2117-2323) — all first appear here',
    commits: 'cc20c249 (fc3087e3) merged 2026-06-20',
  },
  {
    id: 'E2',
    from: '2026-07-03',
    label: 'EDGE-1 quote gate',
    change: 'a leg without a real bid AND ask is rejected (strategy-builder.ts:1143) — which cards exist, their prices and their PoP change',
    commits: '23b519ff (dc81b9a5) merged 2026-07-03',
  },
  {
    id: 'E3',
    from: '2026-07-04',
    label: 'EDGE-2/2b exclusion + EDGE-3 sanity gates',
    change: 'missing sub-scores are excluded and weights renormalized instead of imputed neutral (info-edge TOTAL_SUB_SCORES 10; flow 0.20→…); monotonicity reject and HV10>IV disqualification on candidates',
    commits: 'ebf01596 (d8a0656f), 299b939f (0a31a93f), 21be16bb (7d73ae1a) merged 2026-07-04',
  },
  {
    id: 'E4',
    from: '2026-07-06',
    label: 'KILL-2…7 + EDGE-4',
    change: 'ingestion nulls declared (KILL-2/4); gate-level exclusion with the safety, profitability, earnings-quality and analyst weight tables (KILL-3/5/6/7); VRP z against the ticker’s own history (EDGE-4)',
    commits: '5fc6becc, 5be860a5, 27e0272a, 9902d94f, ee8f8df9, 8156da74, 028e7b14 merged 2026-07-06',
  },
  {
    id: 'E5',
    from: '2026-07-07',
    label: 'MIG-1 nullable gates',
    change: 'a fully-excluded gate scores null and drops out of the composite (composite.ts:128-139); direction UNKNOWN when info-edge is excluded',
    commits: '62d258de (24374b04) merged 2026-07-07',
  },
  {
    id: 'E6',
    from: '2026-07-08',
    label: 'EDGE-6 + EDGE-7b conditioners',
    change: 'regime = 0.70 strategy_regime + 0.20 VIX/VIX3M + 0.10 VVIX with the survival brake (regime.ts:837-839) — the VVIX leg has been dead since this day (DATA-01: VVIXCLS is not a FRED series); info-edge recommendation revision 0.05, flow 0.10→0.05, TOTAL_SUB_SCORES 11',
    commits: '9eca0ebf (2cbf2ed4), 16405f06 (3ca79645) merged 2026-07-08',
  },
  {
    id: 'E7',
    from: '2026-09-10',
    label: 'PIPE-01 inputs',
    change: 'Grok social sentiment dropped, Finnhub profile2 dropped (CIK from SEC), the second fund-ownership call removed — inputs removed, no weight changed',
    commits: '3a649edc (8358dc28) merged 2026-09-10',
  },
  {
    id: 'E8',
    from: '2026-09-15',
    label: 'TRADE-COST-01 cache',
    change: 'no weight changed; the 16 slow-tier Finnhub inputs may now be up to 7 days (quarterly) or 24 h (weekly/monthly) old when scored',
    commits: '247e33c2 (7f283cbe) merged 2026-09-15',
  },
  {
    id: 'E9',
    from: '2026-09-16',
    label: 'MODEL-01 two scores',
    change: 'the composite is two models — sellerScore (today\'s composite, unchanged, renamed) and buyerScore (recomposed per the input-sign table, equal untuned weights set 2026-09-15); the pre-filter splits by side (SELL: IV > HV; BUY: HV above IV by ≥ 1 pt); a BUY candidate exists only with a catalyst (earnings inside the DTE window or HV over IV by ≥ 5 pts); unbounded structures need the filter AND the per-user cap. `from` is the day after authoring — Alex sets the merge date on merge; every MODEL-01 candidate row is stamped E9 from CURRENT_MODEL_ERA regardless of the date',
    commits: 'claude/model-01-two-scores (authored 2026-09-15; merge date to be set)',
  },
];

/**
 * MODEL-01: the era the RUNNING code is. The scan stamps this on every
 * candidate row — the code that scored the candidate knows which model it is;
 * eraFor(date) exists for cards that carry no stamp (trade_cards.generated_at).
 */
export const CURRENT_MODEL_ERA: ModelEra = MODEL_ERAS[MODEL_ERAS.length - 1];

export function eraFor(date: Date): ModelEra {
  const iso = date.toISOString().slice(0, 10);
  let current: ModelEra = MODEL_ERAS[0];
  for (const era of MODEL_ERAS) {
    if (era.from <= iso) current = era;
  }
  return current;
}

/** Cards generated within this many hours of a boundary are counted as "near a boundary". */
export const BOUNDARY_HOURS = 24;

export function nearBoundary(date: Date): boolean {
  const t = date.getTime();
  for (const era of MODEL_ERAS.slice(1)) {
    const b = Date.parse(`${era.from}T00:00:00Z`);
    if (Math.abs(t - b) <= BOUNDARY_HOURS * 3600 * 1000) return true;
  }
  return false;
}
