import type { TTScannerData } from './types';

// ===== TYPES =====

export interface SectorMetricStats {
  mean: number;
  std: number;
}

export interface SectorStats {
  ticker_count: number;
  metrics: {
    iv_percentile: SectorMetricStats;
    iv_hv_spread: SectorMetricStats;
    hv30: SectorMetricStats;
    hv60: SectorMetricStats;
    hv90: SectorMetricStats;
    iv30: SectorMetricStats;
    pe_ratio: SectorMetricStats;
    market_cap: SectorMetricStats;
    beta: SectorMetricStats;
    corr_spy: SectorMetricStats;
    dividend_yield: SectorMetricStats;
    eps: SectorMetricStats;
  };
  insufficient_peers?: boolean;
}

export type SectorStatsMap = Record<string, SectorStats>;

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

function computeMetricStats(values: (number | null | undefined)[]): SectorMetricStats {
  const valid = values.filter((v): v is number => v != null && !isNaN(v));
  return {
    mean: round(mean(valid), 2),
    std: round(stddev(valid), 2),
  };
}

// ===== MAIN FUNCTIONS =====

export function computeSectorStats(scannerResults: TTScannerData[]): SectorStatsMap {
  // Group by sector
  const bySector = new Map<string, TTScannerData[]>();
  for (const item of scannerResults) {
    const sector = item.sector || 'Unknown';
    if (!bySector.has(sector)) {
      bySector.set(sector, []);
    }
    bySector.get(sector)!.push(item);
  }

  const result: SectorStatsMap = {};

  for (const [sector, tickers] of bySector) {
    if (tickers.length < 3) {
      // Flag as insufficient peers
      result[sector] = {
        ticker_count: tickers.length,
        metrics: {
          iv_percentile: { mean: 0, std: 0 },
          iv_hv_spread: { mean: 0, std: 0 },
          hv30: { mean: 0, std: 0 },
          hv60: { mean: 0, std: 0 },
          hv90: { mean: 0, std: 0 },
          iv30: { mean: 0, std: 0 },
          pe_ratio: { mean: 0, std: 0 },
          market_cap: { mean: 0, std: 0 },
          beta: { mean: 0, std: 0 },
          corr_spy: { mean: 0, std: 0 },
          dividend_yield: { mean: 0, std: 0 },
          eps: { mean: 0, std: 0 },
        },
        insufficient_peers: true,
      };
      continue;
    }

    result[sector] = {
      ticker_count: tickers.length,
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
      },
    };
  }

  return result;
}

export function computeZScore(value: number | null, mean: number, std: number): number | null {
  if (value === null || value === undefined) return null;
  if (std < 0.001) return null;
  return round((value - mean) / std, 2);
}
