/**
 * EDGE-01 STEP 1 — the read. Every aggregate is computed per BUCKET first —
 * bucket = (premium direction × strategy family × model-version era) — and
 * never pooled across direction. Pure functions over in-memory tickets; the
 * script (scripts/edge-read.ts) does the reading, this module does the
 * arithmetic and the wording. Nothing here prints a row.
 */
import {
  benchmarkIndexFor,
  familyImpliedSide,
  familyOf,
  sideFromCardLegs,
  sideFromPositionLegs,
  type CardLeg,
  type PremiumSide,
  type StrategyFamily,
} from './families';
import { eraFor, nearBoundary, MODEL_ERAS, type ModelEra } from './eras';
import {
  brierScore,
  clusterCount,
  decileBin,
  fmtMoney,
  fmtRate,
  isoWeekKey,
  MIN_N,
  outcomeStats,
  quartileGroups,
  separationVerdict,
  type OutcomeStats,
} from './stats';
import { windowReturn, type BenchmarkIndex, type SeriesPoint } from './cboe';

export interface TicketPositionLeg {
  positionType: string | null;
  openPrice: number | null;
  quantity: number | null;
  openDate: Date | null;
  expirationDate: Date | null;
  closeDate: Date | null;
  status: string | null;
  strategyRaw: string | null;
}

/** One linked card = one ticket. Built by the script from trade_cards ⋈ trade_card_links ⋈ trading_positions. */
export interface Ticket {
  id: string;
  symbol: string;
  generatedAt: Date;
  cardStrategyRaw: string;
  cardLegs: CardLeg[];
  cardExpirationDate: Date | null;
  positionLegs: TicketPositionLeg[];
  compositeScore: number | null;
  volEdgeScore: number | null;
  qualityScore: number | null;
  regimeScore: number | null;
  infoEdgeScore: number | null;
  /** trade_cards.win_rate — the breakeven-d2 PoP in percent (0–100). */
  predictedWinRatePct: number | null;
  /** trade_cards.max_loss — dollars, stored positive (strategy-builder.ts:530). */
  maxLoss: number | null;
  /** trade_card_links.actual_pl — null while the position is open. */
  actualPl: number | null;
  grade: string | null;
  /** The same-day scan_snapshots row for (userId, symbol), when one exists. */
  snapshot: { excludedFields: string[]; imputedCount: number | null } | null;
  /**
   * Where the bucket direction is read from. The primary book reads the linked
   * position's legs (ruling §3); LOG-01's candidate book has no position for an
   * untaken candidate and reads the card's own legs — declared, never guessed.
   */
  directionSource?: 'position_legs' | 'card_legs';
  /** An extra bucket dimension (LOG-01: TAKEN / UNTAKEN); empty = none. */
  split?: string;
  /** Explicit entry/close dates when no position carries them (LOG-01: generated_at and the expiration a candidate was held to). Undefined = derive from the position legs. */
  entryDate?: Date | null;
  closeDate?: Date | null;
}

export interface ClassifiedTicket {
  t: Ticket;
  family: StrategyFamily;
  familyNormalized: string;
  positionFamily: StrategyFamily;
  positionStrategyRaw: string;
  /** The bucket direction — from trading_positions.position_type (ruling §3). */
  direction: PremiumSide;
  cardSide: PremiumSide;
  era: ModelEra;
  nearEraBoundary: boolean;
  entryDate: Date | null;
  expirationDate: Date | null;
  closeDate: Date | null;
  graded: boolean;
}

export function classifyTicket(t: Ticket): ClassifiedTicket {
  const fam = familyOf(t.cardStrategyRaw);
  const posRaw = t.positionLegs.map((l) => l.strategyRaw).find((s) => s !== null) ?? null;
  const posFam = familyOf(posRaw);
  const opens = t.positionLegs.map((l) => l.openDate).filter((d): d is Date => d !== null);
  const closes = t.positionLegs.map((l) => l.closeDate).filter((d): d is Date => d !== null);
  const exps = t.positionLegs.map((l) => l.expirationDate).filter((d): d is Date => d !== null);
  const minDate = (ds: Date[]) => (ds.length ? new Date(Math.min(...ds.map((d) => d.getTime()))) : null);
  const maxDate = (ds: Date[]) => (ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : null);
  return {
    t,
    family: fam.family,
    familyNormalized: fam.normalized,
    positionFamily: posFam.family,
    positionStrategyRaw: posRaw ?? '(null)',
    direction: t.directionSource === 'card_legs' ? sideFromCardLegs(t.cardLegs) : sideFromPositionLegs(t.positionLegs),
    cardSide: sideFromCardLegs(t.cardLegs),
    era: eraFor(t.generatedAt),
    nearEraBoundary: nearBoundary(t.generatedAt),
    entryDate: t.entryDate !== undefined ? t.entryDate : minDate(opens),
    expirationDate: t.cardExpirationDate ?? minDate(exps),
    closeDate: t.closeDate !== undefined ? t.closeDate : maxDate(closes),
    graded: t.actualPl !== null,
  };
}

export function bucketKey(c: ClassifiedTicket): string {
  return `${c.direction} × ${c.family} × ${c.era.id}${c.t.split ? ` × ${c.t.split}` : ''}`;
}

export interface BenchmarkSeries { PUT?: SeriesPoint[]; CMBO?: SeriesPoint[]; errors: Partial<Record<BenchmarkIndex, string>> }

export interface ReportOptions {
  benchmarks?: BenchmarkSeries;
  today?: Date;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '—');
const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;

function statsLine(label: string, s: OutcomeStats): string {
  return `${label}: win rate ${fmtRate(s)} · wins ${s.wins} · losses ${s.losses} · scratches ${s.scratches} · mean P&L ${fmtMoney(s.meanPl)} · median ${fmtMoney(s.medianPl)} · Σ ${fmtMoney(s.sumPl)} · profit factor ${s.profitFactor === null ? '— (no losses)' : s.profitFactor.toFixed(2)} (n=${s.n})`;
}

function quartileBlock(title: string, items: ClassifiedTicket[], score: (c: ClassifiedTicket) => number | null): string[] {
  const g = quartileGroups(items, score);
  const st = (xs: ClassifiedTicket[]) => outcomeStats(xs.map((c) => c.t.actualPl as number));
  const q1 = st(g.q1);
  const q4 = st(g.q4);
  const range = (xs: ClassifiedTicket[]) => {
    const v = xs.map(score).filter((x): x is number => x !== null);
    return v.length ? `[${Math.min(...v).toFixed(1)}–${Math.max(...v).toFixed(1)}]` : '[—]';
  };
  const sep = separationVerdict(q4, q1);
  return [
    `  ${title} (rank quartiles within this bucket; unscored ${g.unscored.length}):`,
    `    ${statsLine(`Q1 ${range(g.q1)}`, q1)}`,
    `    ${statsLine(`Q2 ${range(g.q2)}`, st(g.q2))}`,
    `    ${statsLine(`Q3 ${range(g.q3)}`, st(g.q3))}`,
    `    ${statsLine(`Q4 ${range(g.q4)}`, q4)}`,
    `    verdict: ${sep.verdict} — ${sep.detail}`,
  ];
}

export interface BucketReport {
  key: string;
  direction: PremiumSide;
  family: StrategyFamily;
  era: ModelEra;
  tickets: ClassifiedTicket[];
  graded: ClassifiedTicket[];
  stats: OutcomeStats;
  compositeVerdict: ReturnType<typeof separationVerdict>;
  brier: number | null;
  lines: string[];
}

export function bucketReport(key: string, tickets: ClassifiedTicket[], opts: ReportOptions): BucketReport {
  const first = tickets[0];
  const graded = tickets.filter((c) => c.graded);
  const pls = graded.map((c) => c.t.actualPl as number);
  const stats = outcomeStats(pls);
  const lines: string[] = [];
  lines.push(`BUCKET ${key} — ${first.era.label}`);

  // (a) n, graded, date range, CI half-width
  const entries = tickets.map((c) => c.entryDate).filter((d): d is Date => d !== null);
  const closes = tickets.map((c) => c.closeDate).filter((d): d is Date => d !== null);
  const from = entries.length ? new Date(Math.min(...entries.map((d) => d.getTime()))) : null;
  const to = closes.length ? new Date(Math.max(...closes.map((d) => d.getTime()))) : null;
  lines.push(`  (a) tickets ${tickets.length} · graded ${graded.length} · not yet closed ${tickets.length - graded.length} · entries ${iso(from)} → last close ${iso(to)} · near an era boundary ${tickets.filter((c) => c.nearEraBoundary).length}`);
  lines.push(`      win rate: ${fmtRate(stats)}${stats.sufficient ? ` — CI half-width ±${((stats.ciHalfWidth as number) * 100).toFixed(1)} points` : ''}`);

  // (b) realized P&L
  lines.push(`  (b) ${statsLine('realized P&L', stats)}`);

  // (c) composite quartiles — the core question
  lines.push(...quartileBlock('(c) by composite_score quartile — does Q4 beat Q1?', graded, (c) => c.t.compositeScore));
  const compositeVerdict = separationVerdict(
    outcomeStats(quartileGroups(graded, (c) => c.t.compositeScore).q4.map((c) => c.t.actualPl as number)),
    outcomeStats(quartileGroups(graded, (c) => c.t.compositeScore).q1.map((c) => c.t.actualPl as number)),
  );

  // (d) each gate sub-score
  lines.push(...quartileBlock('(d) by vol_edge_score quartile', graded, (c) => c.t.volEdgeScore));
  lines.push(...quartileBlock('(d) by quality_score quartile', graded, (c) => c.t.qualityScore));
  lines.push(...quartileBlock('(d) by regime_score quartile', graded, (c) => c.t.regimeScore));
  lines.push(...quartileBlock('(d) by info_edge_score quartile', graded, (c) => c.t.infoEdgeScore));

  // (e) calibration
  const pairs = graded
    .filter((c) => c.t.predictedWinRatePct !== null)
    .map((c) => ({ p: (c.t.predictedWinRatePct as number) / 100, y: ((c.t.actualPl as number) > 0 ? 1 : 0) as 0 | 1 }));
  const brier = brierScore(pairs);
  lines.push(`  (e) calibration — trade_cards.win_rate (breakeven-d2 PoP) in deciles vs realized win frequency (n with a prediction = ${pairs.length}; without = ${graded.length - pairs.length}):`);
  const bins = new Map<number, { p: number; y: 0 | 1 }[]>();
  for (const pr of pairs) {
    const b = decileBin(pr.p);
    bins.set(b, [...(bins.get(b) ?? []), pr]);
  }
  for (let b = 0; b < 10; b += 1) {
    const xs = bins.get(b) ?? [];
    if (xs.length === 0) continue;
    const meanP = xs.reduce((s, x) => s + x.p, 0) / xs.length;
    const realized = xs.length >= MIN_N ? `${pct(xs.filter((x) => x.y === 1).length / xs.length)} (n=${xs.length})` : `insufficient (n=${xs.length})`;
    lines.push(`      ${b * 10}–${b * 10 + 10}%: predicted ${pct(meanP)} → realized ${realized}`);
  }
  lines.push(`      Brier score: ${brier === null ? `insufficient (n=${pairs.length})` : `${brier.toFixed(4)} (n=${pairs.length})`} — Brier = calibration + refinement; a calibrated but unsharp 70% forecast scores 0.21, only calibrated AND sharp approaches 0`);

  // (f) inputs present vs missing
  const complete = graded.filter((c) => allGatesPresent(c) && c.t.snapshot !== null && c.t.snapshot.excludedFields.length === 0);
  const absent = graded.filter((c) => !allGatesPresent(c) || (c.t.snapshot !== null && c.t.snapshot.excludedFields.length > 0));
  const unknown = graded.filter((c) => allGatesPresent(c) && c.t.snapshot === null);
  lines.push('  (f) inputs present vs missing at scan time (a gate column null = the gate was excluded; excluded_fields = the same-day scan_snapshots.fullTrace composite.data_confidence):');
  lines.push(`      ${statsLine('every sub-score present, no excluded input', outcomeStats(complete.map((c) => c.t.actualPl as number)))}`);
  lines.push(`      ${statsLine('an input absent — composite renormalized', outcomeStats(absent.map((c) => c.t.actualPl as number)))}`);
  lines.push(`      ${statsLine('presence unknown — no same-day snapshot for the card', outcomeStats(unknown.map((c) => c.t.actualPl as number)))}`);
  const missingCounts = new Map<string, number>();
  for (const c of absent) {
    const fields = [
      ...(c.t.volEdgeScore === null ? ['vol_edge (gate null)'] : []),
      ...(c.t.qualityScore === null ? ['quality (gate null)'] : []),
      ...(c.t.regimeScore === null ? ['regime (gate null)'] : []),
      ...(c.t.infoEdgeScore === null ? ['info_edge (gate null)'] : []),
      ...(c.t.snapshot?.excludedFields ?? []),
    ];
    for (const f of fields) missingCounts.set(f, (missingCounts.get(f) ?? 0) + 1);
  }
  const top = [...missingCounts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 12);
  if (top.length) lines.push(`      most-missing inputs: ${top.map(([f, k]) => `${f} ×${k}`).join(', ')}`);

  // (g) effective sample size
  const weeks = clusterCount(tickets, (c) => (c.entryDate ? isoWeekKey(c.entryDate) : null));
  const exps = clusterCount(tickets, (c) => (c.expirationDate ? iso(c.expirationDate) : null));
  lines.push(`  (g) effective sample size: ${n(tickets.length, 'ticket')} → ${n(weeks.clusters, 'entry-week cluster')} (entry date unresolved ${weeks.unresolved}) · ${n(exps.clusters, 'expiration cluster')} (expiration unresolved ${exps.unresolved}) — read the smaller cluster count as the number of independent bets`);

  // (h) benchmark for SELL buckets
  if (first.direction === 'SELL') {
    const byIndex = new Map<BenchmarkIndex, ClassifiedTicket[]>();
    let unnamed = 0;
    for (const c of graded) {
      const idx = benchmarkIndexFor(c.familyNormalized);
      if (idx === null) unnamed += 1;
      else byIndex.set(idx, [...(byIndex.get(idx) ?? []), c]);
    }
    for (const [idx, xs] of byIndex) {
      const st = outcomeStats(xs.map((c) => c.t.actualPl as number));
      const withRisk = xs.filter((c) => c.t.maxLoss !== null && (c.t.maxLoss as number) > 0);
      const risk = withRisk.reduce((s, c) => s + (c.t.maxLoss as number), 0);
      const plOnRisk = withRisk.reduce((s, c) => s + (c.t.actualPl as number), 0);
      const bucketRet = withRisk.length > 0 && risk > 0 ? `${pct(plOnRisk / risk)} return on Σ max_loss (n=${withRisk.length}; ${xs.length - withRisk.length} without a max_loss excluded)` : `not computable — no max_loss on ${xs.length - withRisk.length} of ${xs.length}`;
      const e = xs.map((c) => c.entryDate).filter((d): d is Date => d !== null);
      const cl = xs.map((c) => c.closeDate).filter((d): d is Date => d !== null);
      let bench = 'unavailable';
      if (e.length && cl.length) {
        const s = iso(new Date(Math.min(...e.map((d) => d.getTime()))));
        const en = iso(new Date(Math.max(...cl.map((d) => d.getTime()))));
        const series = opts.benchmarks?.[idx];
        const err = opts.benchmarks?.errors[idx];
        if (series) {
          const w = windowReturn(series, s, en);
          bench = w ? `${idx} ${pct(w.ret)} over ${w.startDate} → ${w.endDate} (${w.startLevel.toFixed(2)} → ${w.endLevel.toFixed(2)})` : `unavailable (${idx} has no closes inside ${s} → ${en})`;
        } else {
          bench = `unavailable${err ? ` (${idx}: ${err})` : ''}`;
        }
      } else {
        bench = 'unavailable (bucket window unresolved)';
      }
      lines.push(`  (h) ${idx} benchmark — ${n(xs.length, 'ticket')} (${[...new Set(xs.map((c) => c.familyNormalized))].join(', ')}): bucket Σ P&L ${fmtMoney(st.sumPl)}, ${bucketRet} · benchmark ${bench}`);
    }
    if (unnamed > 0) lines.push(`  (h) ${n(unnamed, 'graded ticket')} in this bucket name no benchmark (ruling §5 names PUT for spreads, CMBO for condors/strangles)`);
  }

  return { key, direction: first.direction, family: first.family, era: first.era, tickets, graded, stats, compositeVerdict, brier, lines };
}

function allGatesPresent(c: ClassifiedTicket): boolean {
  return c.t.volEdgeScore !== null && c.t.qualityScore !== null && c.t.regimeScore !== null && c.t.infoEdgeScore !== null;
}

export interface FullReport {
  buckets: BucketReport[];
  lines: string[];
}

/** Bucket, then report every bucket; also the cross-bucket integrity lines (mismatches, UNMAPPED raw values, era table). */
export function buildReport(tickets: Ticket[], opts: ReportOptions = {}): FullReport {
  const classified = tickets.map(classifyTicket);
  const groups = new Map<string, ClassifiedTicket[]>();
  for (const c of classified) {
    const k = bucketKey(c);
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const order = (k: string) => k;
  const keys = [...groups.keys()].sort((a, b) => order(a).localeCompare(order(b)));
  const buckets = keys.map((k) => bucketReport(k, groups.get(k) as ClassifiedTicket[], opts));

  const lines: string[] = [];
  lines.push('MODEL-VERSION ERAS (merge date on main, UTC — cards bucket by generated_at):');
  for (const era of MODEL_ERAS) {
    const count = classified.filter((c) => c.era.id === era.id).length;
    lines.push(`  ${era.id} from ${era.from} — ${era.label} (${era.commits}): ${count} tickets — ${era.change}`);
  }
  lines.push('');
  lines.push('FAMILY MAPPING — distinct strategy strings and where the const puts them (raw value, never guessed):');
  const cardStrings = new Map<string, { family: StrategyFamily; count: number }>();
  const posStrings = new Map<string, { family: StrategyFamily; count: number }>();
  for (const c of classified) {
    const a = cardStrings.get(c.t.cardStrategyRaw) ?? { family: c.family, count: 0 };
    a.count += 1;
    cardStrings.set(c.t.cardStrategyRaw, a);
    if (c.t.positionLegs.length > 0) {
      const b = posStrings.get(c.positionStrategyRaw) ?? { family: c.positionFamily, count: 0 };
      b.count += 1;
      posStrings.set(c.positionStrategyRaw, b);
    }
  }
  for (const [raw, v] of [...cardStrings.entries()].sort((x, y) => y[1].count - x[1].count)) lines.push(`  card  trade_cards.strategy_name "${raw}" → ${v.family} ×${v.count}`);
  for (const [raw, v] of [...posStrings.entries()].sort((x, y) => y[1].count - x[1].count)) lines.push(`  pos   trading_positions.strategy "${raw}" → ${v.family} ×${v.count}`);
  lines.push('');
  lines.push('DIRECTION CHECKS (reported, not resolved):');
  const sideMismatch = classified.filter((c) => c.direction !== 'UNKNOWN' && c.cardSide !== 'UNKNOWN' && c.direction !== c.cardSide).length;
  const famMismatch = classified.filter((c) => {
    const implied = familyImpliedSide(c.family);
    return implied !== null && c.direction !== 'UNKNOWN' && implied !== c.direction;
  }).length;
  const unknownDir = classified.filter((c) => c.direction === 'UNKNOWN').length;
  const posFamMismatch = classified.filter((c) => c.positionFamily !== 'UNMAPPED' && c.positionFamily !== c.family).length;
  lines.push(`  position legs (position_type) vs card legs (side×price) disagree on premium direction: ${sideMismatch} of ${classified.length}`);
  lines.push(`  card family implies a side that position_type contradicts: ${famMismatch} of ${classified.length}`);
  lines.push(`  card family vs mapped position-string family disagree (both mapped): ${posFamMismatch} of ${classified.length}`);
  lines.push(`  premium direction UNKNOWN from position legs (missing price/quantity/type, or net zero): ${unknownDir} of ${classified.length}`);
  lines.push('');
  lines.push(`BUCKETS (direction × family × era) — ${buckets.length} bucket${buckets.length === 1 ? '' : 's'} from ${n(classified.length, 'ticket')}; ${MIN_N} graded tickets needed for any percentage:`);
  for (const b of buckets) {
    lines.push('');
    lines.push(...b.lines);
  }
  return { buckets, lines };
}

/** The secondary book: every CLOSED trading_positions trade, scored or not — direction × position-string family × era of open_date; (a) (b) (g) (h) only. */
export interface ClosedTrade {
  tradeNum: string;
  legs: TicketPositionLeg[];
  realizedPl: number;
  linked: boolean;
}

export function secondaryBookReport(trades: ClosedTrade[], opts: ReportOptions = {}): string[] {
  const lines: string[] = [];
  const rows = trades.map((tr) => {
    const posRaw = tr.legs.map((l) => l.strategyRaw).find((s) => s !== null) ?? null;
    const fam = familyOf(posRaw);
    const opens = tr.legs.map((l) => l.openDate).filter((d): d is Date => d !== null);
    const closes = tr.legs.map((l) => l.closeDate).filter((d): d is Date => d !== null);
    const exps = tr.legs.map((l) => l.expirationDate).filter((d): d is Date => d !== null);
    const entry = opens.length ? new Date(Math.min(...opens.map((d) => d.getTime()))) : null;
    const close = closes.length ? new Date(Math.max(...closes.map((d) => d.getTime()))) : null;
    const exp = exps.length ? new Date(Math.min(...exps.map((d) => d.getTime()))) : null;
    return { tr, family: fam.family, familyNormalized: fam.normalized, raw: posRaw ?? '(null)', direction: sideFromPositionLegs(tr.legs), era: entry ? eraFor(entry) : MODEL_ERAS[0], entry, close, exp };
  });
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.direction} × ${r.family} × ${r.era.id}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  lines.push(`SECONDARY BOOK — every CLOSED trade (${n(trades.length, 'trade')}; linked to a card ${trades.filter((t) => t.linked).length}; never linked ${trades.filter((t) => !t.linked).length}) — no prediction on the unlinked rows, so (a) (b) (g) (h) only:`);
  const rawCounts = new Map<string, { family: StrategyFamily; count: number }>();
  for (const r of rows) {
    const v = rawCounts.get(r.raw) ?? { family: r.family, count: 0 };
    v.count += 1;
    rawCounts.set(r.raw, v);
  }
  for (const [raw, v] of [...rawCounts.entries()].sort((x, y) => y[1].count - x[1].count)) lines.push(`  trading_positions.strategy "${raw}" → ${v.family} ×${v.count}`);
  for (const k of [...groups.keys()].sort()) {
    const xs = groups.get(k) as typeof rows;
    const st = outcomeStats(xs.map((r) => r.tr.realizedPl));
    lines.push('');
    lines.push(`BUCKET ${k} — ${xs[0].era.label}`);
    lines.push(`  (a) trades ${xs.length} · linked ${xs.filter((r) => r.tr.linked).length} · never linked ${xs.filter((r) => !r.tr.linked).length} · entries ${iso(xs.map((r) => r.entry).filter((d): d is Date => d !== null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null)} → last close ${iso(xs.map((r) => r.close).filter((d): d is Date => d !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null)}`);
    lines.push(`  (b) ${statsLine('realized P&L', st)}`);
    const weeks = clusterCount(xs, (r) => (r.entry ? isoWeekKey(r.entry) : null));
    const exps = clusterCount(xs, (r) => (r.exp ? iso(r.exp) : null));
    lines.push(`  (g) ${n(xs.length, 'trade')} → ${n(weeks.clusters, 'entry-week cluster')} (unresolved ${weeks.unresolved}) · ${n(exps.clusters, 'expiration cluster')} (unresolved ${exps.unresolved})`);
    if (xs[0].direction === 'SELL') {
      const idx = benchmarkIndexFor(xs[0].familyNormalized);
      const e = xs.map((r) => r.entry).filter((d): d is Date => d !== null);
      const cl = xs.map((r) => r.close).filter((d): d is Date => d !== null);
      if (idx === null) {
        lines.push(`  (h) benchmark: none named for "${xs[0].raw}" (the position-side string does not say credit spread vs condor; ruling §5 names PUT for spreads, CMBO for condors/strangles)`);
      } else if (e.length && cl.length) {
        const s = iso(new Date(Math.min(...e.map((d) => d.getTime()))));
        const en = iso(new Date(Math.max(...cl.map((d) => d.getTime()))));
        const series = opts.benchmarks?.[idx];
        const w = series ? windowReturn(series, s, en) : null;
        lines.push(`  (h) ${idx} benchmark over ${s} → ${en}: ${w ? `${pct(w.ret)} (${w.startLevel.toFixed(2)} → ${w.endLevel.toFixed(2)})` : `unavailable${opts.benchmarks?.errors[idx] ? ` (${opts.benchmarks.errors[idx]})` : ''}`} · bucket Σ P&L ${fmtMoney(st.sumPl)} (return on risk not computable — no max_loss on the position side)`);
      } else {
        lines.push('  (h) benchmark: unavailable (bucket window unresolved)');
      }
    }
  }
  return lines;
}
