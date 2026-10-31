/**
 * EDGE-01 — the statistics of the read. Every rate carries its n; below
 * MIN_N a rate prints "insufficient (n=…)" and never a percentage.
 */
export const MIN_N = 30;

/** 95% CI half-width on a proportion: 1.96·√(p(1−p)/n). */
export function ciHalfWidth(p: number, n: number): number {
  if (n <= 0) return NaN;
  return 1.96 * Math.sqrt((p * (1 - p)) / n);
}

export interface OutcomeStats {
  n: number;
  wins: number;
  losses: number;
  scratches: number;
  sumPl: number;
  meanPl: number | null;
  medianPl: number | null;
  /** Σ wins ÷ |Σ losses|; null when there is no loss (undefined, not infinite). */
  profitFactor: number | null;
  sufficient: boolean;
  /** wins ÷ n — null below MIN_N (never a rate on eleven trades). */
  winRate: number | null;
  ciHalfWidth: number | null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** A WIN is realized P&L > 0. Zero is a scratch — counted, reported, never a win (ruling §2). */
export function outcomeStats(pls: readonly number[]): OutcomeStats {
  const n = pls.length;
  const wins = pls.filter((p) => p > 0).length;
  const losses = pls.filter((p) => p < 0).length;
  const scratches = pls.filter((p) => p === 0).length;
  const sumPl = pls.reduce((a, b) => a + b, 0);
  const sumWins = pls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const sumLosses = Math.abs(pls.filter((p) => p < 0).reduce((a, b) => a + b, 0));
  const sufficient = n >= MIN_N;
  const p = n > 0 ? wins / n : 0;
  return {
    n,
    wins,
    losses,
    scratches,
    sumPl,
    meanPl: n > 0 ? sumPl / n : null,
    medianPl: median(pls),
    profitFactor: sumLosses > 0 ? sumWins / sumLosses : null,
    sufficient,
    winRate: sufficient ? p : null,
    ciHalfWidth: sufficient ? ciHalfWidth(p, n) : null,
  };
}

export function fmtRate(s: OutcomeStats): string {
  if (!s.sufficient || s.winRate === null || s.ciHalfWidth === null) return `insufficient (n=${s.n})`;
  return `${(s.winRate * 100).toFixed(1)}% ±${(s.ciHalfWidth * 100).toFixed(1)} (n=${s.n})`;
}

export function fmtMoney(x: number | null): string {
  if (x === null || !Number.isFinite(x)) return '—';
  const sign = x < 0 ? '-' : '';
  return `${sign}$${Math.abs(x).toFixed(2)}`;
}

export interface QuartileGroups<T> {
  q1: T[];
  q2: T[];
  q3: T[];
  q4: T[];
  unscored: T[];
}

/** Rank-based quartiles (ascending score): Q1 = lowest quarter, Q4 = highest. Ties keep insertion order. */
export function quartileGroups<T>(items: readonly T[], score: (t: T) => number | null): QuartileGroups<T> {
  const scored = items.filter((t) => score(t) !== null);
  const unscored = items.filter((t) => score(t) === null);
  const sorted = [...scored].sort((a, b) => (score(a) as number) - (score(b) as number));
  const groups: QuartileGroups<T> = { q1: [], q2: [], q3: [], q4: [], unscored };
  const n = sorted.length;
  sorted.forEach((t, i) => {
    const q = Math.min(4, Math.floor((i * 4) / n) + 1);
    (q === 1 ? groups.q1 : q === 2 ? groups.q2 : q === 3 ? groups.q3 : groups.q4).push(t);
  });
  return groups;
}

export type SeparationVerdict = 'Q4 beats Q1' | 'Q1 beats Q4' | 'no separation' | 'insufficient';

/**
 * Conservative: Q4 beats Q1 only when the two 95% intervals do not overlap.
 * Either quartile below MIN_N → insufficient (the question cannot be answered).
 */
export function separationVerdict(q4: OutcomeStats, q1: OutcomeStats): { verdict: SeparationVerdict; detail: string } {
  if (!q4.sufficient || !q1.sufficient) {
    return { verdict: 'insufficient', detail: `insufficient (Q4 n=${q4.n}, Q1 n=${q1.n}; ${MIN_N} needed in each)` };
  }
  const diff = (q4.winRate as number) - (q1.winRate as number);
  const gap = (q4.ciHalfWidth as number) + (q1.ciHalfWidth as number);
  const pts = `${diff >= 0 ? '+' : ''}${(diff * 100).toFixed(1)} points (Q4 ${fmtRate(q4)} vs Q1 ${fmtRate(q1)})`;
  if (diff > gap) return { verdict: 'Q4 beats Q1', detail: `${pts} — intervals do not overlap` };
  if (diff < -gap) return { verdict: 'Q1 beats Q4', detail: `${pts} — intervals do not overlap` };
  return { verdict: 'no separation', detail: `${pts} — intervals overlap` };
}

/** Decile of a probability in [0,1]: 0 = [0,0.1) … 9 = [0.9,1]. */
export function decileBin(p: number): number {
  return Math.max(0, Math.min(9, Math.floor(p * 10)));
}

/**
 * Brier = mean((p − y)²). It is calibration + refinement: a perfectly
 * calibrated but unsharp 70% forecast scores 0.21; only a calibrated AND
 * sharp forecast approaches 0. Null below MIN_N.
 */
export function brierScore(pairs: readonly { p: number; y: 0 | 1 }[]): number | null {
  if (pairs.length < MIN_N) return null;
  return pairs.reduce((s, { p, y }) => s + (p - y) ** 2, 0) / pairs.length;
}

export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function clusterCount<T>(items: readonly T[], key: (t: T) => string | null): { clusters: number; unresolved: number } {
  const keys = new Set<string>();
  let unresolved = 0;
  for (const t of items) {
    const k = key(t);
    if (k === null) unresolved += 1;
    else keys.add(k);
  }
  return { clusters: keys.size, unresolved };
}

/**
 * Ruling STEP 2: ~194 independent trades per bucket to see a 10-point edge at
 * 95%/80% — the one-sample proportion test n = ((z₀.₉₇₅·√(p₀q₀) + z₀.₈·√(p₁q₁)) / δ)²
 * with p₀ = 0.50, p₁ = 0.60: ((1.96·0.5 + 0.8416·0.4899) / 0.10)² ≈ 193.7.
 */
export function tradesNeededForTenPointEdge(): number {
  const z975 = 1.959964;
  const z80 = 0.841621;
  const p0 = 0.5;
  const p1 = 0.6;
  const n = ((z975 * Math.sqrt(p0 * (1 - p0)) + z80 * Math.sqrt(p1 * (1 - p1))) / (p1 - p0)) ** 2;
  return Math.ceil(n);
}
