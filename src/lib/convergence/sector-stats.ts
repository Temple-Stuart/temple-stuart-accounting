import type { TTScannerData } from './types';

// ===== TYPES =====

export interface PeerMetricStats {
  mean: number;
  std: number;
  sortedValues: number[];  // Sorted peer values for percentile ranking (Mandelbrot 1963; Fama 1965)
}

export interface PeerStats {
  ticker_count: number;
  peer_group_type: 'industry' | 'sector_fallback' | 'unknown';
  peer_group_name: string;
  metrics: {
    iv_percentile: PeerMetricStats;
    iv_hv_spread: PeerMetricStats;
    hv30: PeerMetricStats;
    hv60: PeerMetricStats;
    hv90: PeerMetricStats;
    iv30: PeerMetricStats;
    pe_ratio: PeerMetricStats;
    market_cap: PeerMetricStats;
    beta: PeerMetricStats;
    corr_spy: PeerMetricStats;
    dividend_yield: PeerMetricStats;
    eps: PeerMetricStats;
    term_structure_slope: PeerMetricStats;
  };
  insufficient_peers?: boolean;
}

export type PeerStatsMap = Record<string, PeerStats>;

/** Per-ticker assignment: maps symbol → peer group key in PeerStatsMap */
export type PeerGroupAssignment = Record<string, string>;

// ===== HELPERS =====

function round(v: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round(v * f) / f;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((sum, v) => sum + (v - m) ** 2, 0) / (arr.length - 1));
}

function computeMetricStats(values: (number | null | undefined)[]): PeerMetricStats {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  return {
    mean: round(mean(valid), 2),
    std: round(stddev(valid), 2),
    sortedValues: [...valid].sort((a, b) => a - b),
  };
}

function computeTermStructureSlope(ts: { date: string; iv: number }[]): number | null {
  if (ts.length < 2) return null;
  const sorted = [...ts].sort((a, b) => a.date.localeCompare(b.date));
  const frontIV = sorted[0].iv;
  const backIV = sorted[sorted.length - 1].iv;
  if (frontIV <= 0) return null;
  return (backIV - frontIV) / frontIV;
}

function buildPeerStats(
  tickers: TTScannerData[],
  peerGroupType: 'industry' | 'sector_fallback' | 'unknown',
  peerGroupName: string,
): PeerStats {
  if (tickers.length < 3) {
    const empty: PeerMetricStats = { mean: 0, std: 0, sortedValues: [] };
    return {
      ticker_count: tickers.length,
      peer_group_type: peerGroupType,
      peer_group_name: peerGroupName,
      metrics: {
        iv_percentile: { ...empty },
        iv_hv_spread: { ...empty },
        hv30: { ...empty },
        hv60: { ...empty },
        hv90: { ...empty },
        iv30: { ...empty },
        pe_ratio: { ...empty },
        market_cap: { ...empty },
        beta: { ...empty },
        corr_spy: { ...empty },
        dividend_yield: { ...empty },
        eps: { ...empty },
        term_structure_slope: { ...empty },
      },
      insufficient_peers: true,
    };
  }

  return {
    ticker_count: tickers.length,
    peer_group_type: peerGroupType,
    peer_group_name: peerGroupName,
    metrics: {
      iv_percentile: computeMetricStats(tickers.map(t => t.ivPercentile)),
      iv_hv_spread: computeMetricStats(tickers.map(t => t.ivHvSpread)),
      hv30: computeMetricStats(tickers.map(t => t.hv30)),
      hv60: computeMetricStats(tickers.map(t => t.hv60)),
      hv90: computeMetricStats(tickers.map(t => t.hv90)),
      iv30: computeMetricStats(tickers.map(t => t.iv30)),
      pe_ratio: computeMetricStats(tickers.map(t => t.peRatio)),
      market_cap: computeMetricStats(tickers.map(t => t.marketCap)),
      beta: computeMetricStats(tickers.map(t => t.beta)),
      corr_spy: computeMetricStats(tickers.map(t => t.corrSpy)),
      dividend_yield: computeMetricStats(tickers.map(t => t.dividendYield)),
      eps: computeMetricStats(tickers.map(t => t.eps)),
      term_structure_slope: computeMetricStats(tickers.map(t => computeTermStructureSlope(t.termStructure))),
    },
  };
}

// ===== MAIN FUNCTIONS =====

const MIN_INDUSTRY_PEERS = 5;

export function computePeerStats(
  scannerResults: TTScannerData[],
): { stats: PeerStatsMap; assignment: PeerGroupAssignment } {
  // Step 1: Group by industry
  const byIndustry = new Map<string, TTScannerData[]>();
  // Step 2: Group by sector (for fallback)
  const bySector = new Map<string, TTScannerData[]>();
  // Track each ticker's industry and sector for assignment
  const tickerIndustry = new Map<string, string | null>();
  const tickerSector = new Map<string, string | null>();

  for (const item of scannerResults) {
    const industry = item.industry || null;
    const sector = item.sector || null;
    tickerIndustry.set(item.symbol, industry);
    tickerSector.set(item.symbol, sector);

    // Always add to sector group (used for fallback)
    const sectorKey = sector || 'UNKNOWN';
    if (!bySector.has(sectorKey)) bySector.set(sectorKey, []);
    bySector.get(sectorKey)!.push(item);

    // Add to industry group
    if (industry) {
      if (!byIndustry.has(industry)) byIndustry.set(industry, []);
      byIndustry.get(industry)!.push(item);
    }
  }

  const result: PeerStatsMap = {};
  const assignment: PeerGroupAssignment = {};
  const industryFallbacks: string[] = [];
  const industryUsed: string[] = [];

  // Step 3: Build industry-level stats for groups with >= MIN_INDUSTRY_PEERS
  const validIndustries = new Set<string>();
  for (const [industry, tickers] of byIndustry) {
    if (tickers.length >= MIN_INDUSTRY_PEERS) {
      validIndustries.add(industry);
      const key = `industry:${industry}`;
      result[key] = buildPeerStats(tickers, 'industry', industry);
    }
  }

  // Step 4: Build sector-level stats (used as fallback)
  const sectorKeys = new Map<string, string>();
  for (const [sector, tickers] of bySector) {
    const key = `sector:${sector}`;
    sectorKeys.set(sector, key);
    result[key] = buildPeerStats(tickers, 'sector_fallback', sector);
  }

  // Step 5: Assign each ticker to its peer group
  for (const item of scannerResults) {
    const industry = tickerIndustry.get(item.symbol);
    const sector = tickerSector.get(item.symbol);

    if (industry && validIndustries.has(industry)) {
      // Industry group has >= 5 peers — use industry
      assignment[item.symbol] = `industry:${industry}`;
      industryUsed.push(item.symbol);
    } else if (sector) {
      // Industry too small or null — fall back to sector
      assignment[item.symbol] = `sector:${sector}`;
      industryFallbacks.push(item.symbol);
    } else {
      // Both null — use UNKNOWN
      assignment[item.symbol] = `sector:UNKNOWN`;
      industryFallbacks.push(item.symbol);
    }
  }

  // Log peer group assignments
  if (industryUsed.length > 0) {
    console.log(`[PeerStats] ${industryUsed.length} tickers using industry-level peers`);
  }
  if (industryFallbacks.length > 0) {
    console.log(`[PeerStats] ${industryFallbacks.length} tickers using sector-level fallback: ${industryFallbacks.slice(0, 10).join(', ')}${industryFallbacks.length > 10 ? '...' : ''}`);
  }

  return { stats: result, assignment };
}

export function computeZScore(value: number | null, mean: number, std: number): number | null {
  if (value === null || value === undefined) return null;
  if (std < 0.001) return null;
  return round((value - mean) / std, 2);
}

// ===== BACKWARDS COMPAT (type aliases) =====

/** @deprecated Use PeerMetricStats */
export type SectorMetricStats = PeerMetricStats;
/** @deprecated Use PeerStats */
export type SectorStats = PeerStats;
/** @deprecated Use PeerStatsMap */
export type SectorStatsMap = PeerStatsMap;
