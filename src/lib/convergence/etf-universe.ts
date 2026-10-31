/**
 * MODEL-02 STEP 4 — THE ETF LAYER: index and sector ETFs as their own
 * selectable universe ("Index & sector ETFs"), beside the S&P 500 and the
 * Nasdaq 100. One dated const; a leaf (no imports) read by the pipeline's
 * universe selector, the hard filters and the panels.
 *
 * Why: the variance-risk-premium literature the scanner rests on measures the
 * premium in index and sector ETF options (Driessen, Maenhout & Vilkov 2009 —
 * the index premium exceeds the sum of its constituents'). MODEL-01 confirmed
 * an ETF scores on Vol-Edge + Regime with the fundamental gates null and the
 * card names the gates that scored it.
 *
 * What an ETF member gets that a stock does not: NOTHING imputed. Hard filter
 * 1 (issuer market cap > $2B) is DECLARED not applicable to a member when
 * TastyTrade returns no market cap (an ETF has no issuer cap) and passes with
 * a warning on the record; every other gate reads the member's own data or
 * excludes it. A member TastyTrade returns no market-metrics row or no chain
 * for is REPORTED on the scan (errors, data gaps, rejection reasons) — never
 * silently dropped.
 *
 * Addendum (ruled 2026-09-16): at the structure cut (structure-cut.ts) a
 * member's convergence is judged on the gates that can score (2 of 2 when
 * only Vol-Edge and Regime score) and the quality-null rule does not bar it;
 * the card states "scored on N of 4 gates". Single names are untouched.
 */
export const ETF_UNIVERSE_SET_ON = '2026-09-16';

export interface EtfUniverseMember {
  symbol: string;
  name: string;
  kind: 'index' | 'sector';
}

export const ETF_UNIVERSE: readonly EtfUniverseMember[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust', kind: 'index' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust (Nasdaq-100)', kind: 'index' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF', kind: 'index' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF Trust', kind: 'index' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLY', name: 'Consumer Discretionary Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLI', name: 'Industrial Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLU', name: 'Utilities Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLB', name: 'Materials Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR Fund', kind: 'sector' },
  { symbol: 'XLC', name: 'Communication Services Select Sector SPDR Fund', kind: 'sector' },
];

export const ETF_UNIVERSE_SYMBOLS: readonly string[] = ETF_UNIVERSE.map((e) => e.symbol);

/** The universe key the route accepts and the panels send. */
export const ETF_UNIVERSE_KEY = 'etf';
/** The panels' label. */
export const ETF_UNIVERSE_LABEL = 'Index & sector ETFs';

const MEMBERS = new Set(ETF_UNIVERSE_SYMBOLS);
export function isEtfUniverseSymbol(symbol: string): boolean {
  return MEMBERS.has(symbol);
}
